import type { Dispatch } from 'react'
import type { WriteStream } from 'tty'
import { useApp, useInput } from 'ink'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Shortcut } from '~/keymap'
import type { Action, AppState, ScanResult } from '~/utils/types'
import { executeAction } from '~/execute-action'
import { compileIgnoreMatcher, loadAllIgnorePatterns } from '~/utils/ignore'
import { scanRemote } from '~/utils/rclone'
import { scanDirectory } from '~/utils/scanner'

export { useListNavigation } from '~/hooks/use-list-navigation'
export { useScrollNavigation } from '~/hooks/use-scroll-navigation'
export { useUniversalShortcuts } from '~/hooks/use-universal-shortcuts'

export function useTerminalDimensions(stdout: WriteStream | undefined) {
    const [dimensions, setDimensions] = useState({
        columns: stdout?.columns ?? 80,
        rows: stdout?.rows ?? 24,
    })

    useEffect(() => {
        if (!stdout) return
        const onResize = () => {
            setDimensions({ columns: stdout.columns, rows: stdout.rows })
        }
        stdout.on('resize', onResize)
        return () => {
            stdout.off('resize', onResize)
        }
    }, [stdout])

    return dimensions
}

export function useToast() {
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const showToast = useCallback((message: string, durationMs = 4000) => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setToastMessage(message)
        timerRef.current = setTimeout(() => {
            setToastMessage(null)
            timerRef.current = null
        }, durationMs)
    }, [])

    return { toastMessage, showToast }
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

export function useDirectoryScan(
    leftDir: string,
    rightDir: string,
    dispatch: Dispatch<Action>,
    ignoreEnabled: boolean,
    showToast: (message: string) => void,
    extraIgnorePatterns: string[] = [],
    leftRemote?: string,
    rightRemote?: string,
    leftPreScan?: ScanResult,
    rightPreScan?: ScanResult,
    compareContents: boolean = true,
) {
    const [refreshCounter, setRefreshCounter] = useState(0)
    const preScanUsed = useRef(false)

    useEffect(() => {
        const { global, pair } = loadAllIgnorePatterns(leftDir, rightDir)
        dispatch({ type: 'SET_IGNORE_PATTERNS', global, pair })

        // Use pre-scanned results on first render (from concurrent lsjson during mount)
        if (!preScanUsed.current && (leftPreScan || rightPreScan)) {
            preScanUsed.current = true
            const shouldIgnore =
                ignoreEnabled ?
                    compileIgnoreMatcher([
                        ...global,
                        ...pair,
                        ...extraIgnorePatterns,
                    ])
                :   null
            const start = performance.now()
            // Only scan sides that don't have pre-scanned results
            const leftPromise =
                leftPreScan ?
                    Promise.resolve(leftPreScan)
                :   scanDirectory(leftDir, shouldIgnore, compareContents)
            const rightPromise =
                rightPreScan ?
                    Promise.resolve(rightPreScan)
                :   scanDirectory(rightDir, shouldIgnore, compareContents)
            Promise.all([leftPromise, rightPromise])
                .then(([leftScan, rightScan]) => {
                    const elapsed = performance.now() - start
                    dispatch({ type: 'SCAN_COMPLETE', leftScan, rightScan })
                    showToast(`Scanned in ${formatDuration(elapsed)}`)
                })
                .catch((err) => {
                    dispatch({ type: 'SCAN_ERROR', error: String(err) })
                })
            return
        }

        const shouldIgnore =
            ignoreEnabled ?
                compileIgnoreMatcher([
                    ...global,
                    ...pair,
                    ...extraIgnorePatterns,
                ])
            :   null
        const start = performance.now()
        Promise.all([
            leftRemote ?
                scanRemote(leftRemote, shouldIgnore)
            :   scanDirectory(leftDir, shouldIgnore, compareContents),
            rightRemote ?
                scanRemote(rightRemote, shouldIgnore)
            :   scanDirectory(rightDir, shouldIgnore, compareContents),
        ])
            .then(([leftScan, rightScan]) => {
                const elapsed = performance.now() - start
                dispatch({ type: 'SCAN_COMPLETE', leftScan, rightScan })
                showToast(`Scanned in ${formatDuration(elapsed)}`)
            })
            .catch((err) => {
                dispatch({ type: 'SCAN_ERROR', error: String(err) })
            })
    }, [leftDir, rightDir, refreshCounter, ignoreEnabled, compareContents])

    const refresh = useCallback(() => {
        setRefreshCounter((c) => c + 1)
    }, [])

    return { refresh }
}

const SCROLL_CONFIG: Record<
    string,
    { direction: 'up' | 'down'; factor: number }
> = {
    halfPageDown: { direction: 'down', factor: 0.5 },
    halfPageUp: { direction: 'up', factor: 0.5 },
    fullPageDown: { direction: 'down', factor: 1 },
    fullPageUp: { direction: 'up', factor: 1 },
}

export type MatchResult =
    | { type: 'scroll'; direction: 'up' | 'down'; count: number }
    | { type: 'sequence-partial' }
    | { type: 'matched'; shortcut: Shortcut }
    | null

export function matchShortcut(
    input: string,
    key: import('ink').Key,
    keymap: Shortcut[],
    pendingKeys: string,
    contentHeight: number,
): MatchResult {
    // Scroll shortcuts need dynamic count based on contentHeight
    for (const shortcut of keymap) {
        const scrollCfg = SCROLL_CONFIG[shortcut.id]
        if (!scrollCfg) continue
        if (!shortcut.match(input, key)) continue
        return {
            type: 'scroll',
            direction: scrollCfg.direction,
            count: Math.floor(contentHeight * scrollCfg.factor),
        }
    }

    const pending = pendingKeys + input

    // Check for sequence matches first
    for (const shortcut of keymap) {
        if (
            shortcut.mode !== 'global'
            && shortcut.mode !== 'browser'
            && shortcut.mode !== 'universal'
        )
            continue
        if (!shortcut.sequence) continue
        if (pending === shortcut.sequence) {
            return { type: 'matched', shortcut }
        }
        if (
            pending.length > 0
            && shortcut.sequence.startsWith(pending)
            && pending.length < shortcut.sequence.length
        ) {
            return { type: 'sequence-partial' }
        }
    }

    // No sequence match — check normal shortcuts
    for (const shortcut of keymap) {
        if (
            shortcut.mode !== 'global'
            && shortcut.mode !== 'browser'
            && shortcut.mode !== 'universal'
        )
            continue
        if (shortcut.sequence) continue
        if (SCROLL_CONFIG[shortcut.id]) continue
        if (!shortcut.match(input, key)) continue
        return { type: 'matched', shortcut }
    }

    return null
}

export function useKeymap(
    state: AppState,
    keymap: Shortcut[],
    leftDir: string,
    rightDir: string,
    dispatch: Dispatch<Action>,
    isActive: boolean = true,
    onRefresh?: () => void,
    contentHeight: number = 20,
    onShellOut?: (command: string, args: string[]) => void,
) {
    const { exit } = useApp()
    const pendingKeyRef = useRef('')
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
        }
    }, [])

    useInput(
        (input, key) => {
            const result = matchShortcut(
                input,
                key,
                keymap,
                pendingKeyRef.current,
                contentHeight,
            )

            if (!result) {
                pendingKeyRef.current = ''
                if (pendingTimerRef.current)
                    clearTimeout(pendingTimerRef.current)
                return
            }

            if (result.type === 'scroll') {
                dispatch({
                    type: 'MOVE_CURSOR',
                    direction: result.direction,
                    count: result.count,
                })
                return
            }

            if (result.type === 'sequence-partial') {
                pendingKeyRef.current = pendingKeyRef.current + input
                if (pendingTimerRef.current)
                    clearTimeout(pendingTimerRef.current)
                pendingTimerRef.current = setTimeout(() => {
                    pendingKeyRef.current = ''
                }, 500)
                return
            }

            // matched
            pendingKeyRef.current = ''
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)

            if (result.shortcut.effect.type === 'exit') {
                exit()
                return
            }

            executeAction(
                result.shortcut.effect.action,
                state,
                leftDir,
                rightDir,
                dispatch,
                exit,
                onRefresh,
                onShellOut,
            )
        },
        { isActive },
    )
}
