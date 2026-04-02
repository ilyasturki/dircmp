import type { Dispatch } from 'react'
import type { WriteStream } from 'tty'
import { useApp, useInput } from 'ink'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Action, AppState } from '~/utils/types'
import { executeAction } from '~/execute-action'
import { keymap } from '~/keymap'
import { compileIgnoreMatcher, loadAllIgnorePatterns } from '~/utils/ignore'
import { scanDirectory } from '~/utils/scanner'

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
) {
    const [refreshCounter, setRefreshCounter] = useState(0)

    useEffect(() => {
        const { global, pair } = loadAllIgnorePatterns(leftDir, rightDir)
        dispatch({ type: 'SET_IGNORE_PATTERNS', global, pair })
        const shouldIgnore =
            ignoreEnabled ? compileIgnoreMatcher([...global, ...pair]) : null
        const start = performance.now()
        Promise.all([
            scanDirectory(leftDir, shouldIgnore),
            scanDirectory(rightDir, shouldIgnore),
        ])
            .then(([leftScan, rightScan]) => {
                const elapsed = performance.now() - start
                dispatch({ type: 'SCAN_COMPLETE', leftScan, rightScan })
                showToast(`Scanned in ${formatDuration(elapsed)}`)
            })
            .catch((err) => {
                dispatch({ type: 'SCAN_ERROR', error: String(err) })
            })
    }, [leftDir, rightDir, refreshCounter, ignoreEnabled])

    const refresh = useCallback(() => {
        setRefreshCounter((c) => c + 1)
    }, [])

    return { refresh }
}

export function useKeymap(
    state: AppState,
    leftDir: string,
    rightDir: string,
    dispatch: Dispatch<Action>,
    isActive: boolean = true,
    onRefresh?: () => void,
    contentHeight: number = 20,
) {
    const { exit } = useApp()
    const pendingKeyRef = useRef('')
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useInput(
        (input, key) => {
            // ctrl+d / ctrl+u: half-page scroll (before sequence/keymap processing)
            if (key.ctrl && input === 'd') {
                dispatch({
                    type: 'MOVE_CURSOR',
                    direction: 'down',
                    count: Math.floor(contentHeight / 2),
                })
                return
            }
            if (key.ctrl && input === 'u') {
                dispatch({
                    type: 'MOVE_CURSOR',
                    direction: 'up',
                    count: Math.floor(contentHeight / 2),
                })
                return
            }

            // ctrl+f / ctrl+b: full-page scroll
            if (key.ctrl && input === 'f') {
                dispatch({
                    type: 'MOVE_CURSOR',
                    direction: 'down',
                    count: contentHeight,
                })
                return
            }
            if (key.ctrl && input === 'b') {
                dispatch({
                    type: 'MOVE_CURSOR',
                    direction: 'up',
                    count: contentHeight,
                })
                return
            }

            const pending = pendingKeyRef.current + input

            // Check for sequence matches first
            for (const shortcut of keymap) {
                if (shortcut.mode !== 'global' && shortcut.mode !== 'browser')
                    continue
                if (!shortcut.sequence) continue
                if (pending === shortcut.sequence) {
                    pendingKeyRef.current = ''
                    if (pendingTimerRef.current)
                        clearTimeout(pendingTimerRef.current)
                    if (shortcut.effect.type === 'exit') exit()
                    else dispatch(shortcut.effect.action)
                    return
                }
                if (
                    pending.length > 0
                    && shortcut.sequence.startsWith(pending)
                    && pending.length < shortcut.sequence.length
                ) {
                    pendingKeyRef.current = pending
                    if (pendingTimerRef.current)
                        clearTimeout(pendingTimerRef.current)
                    pendingTimerRef.current = setTimeout(() => {
                        pendingKeyRef.current = ''
                    }, 500)
                    return
                }
            }

            // No sequence match — clear pending and check normal shortcuts
            pendingKeyRef.current = ''
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)

            for (const shortcut of keymap) {
                if (shortcut.mode !== 'global' && shortcut.mode !== 'browser')
                    continue
                if (shortcut.sequence) continue
                if (!shortcut.match(input, key)) continue

                if (shortcut.effect.type === 'exit') {
                    exit()
                    return
                }

                executeAction(
                    shortcut.effect.action,
                    state,
                    leftDir,
                    rightDir,
                    dispatch,
                    exit,
                    onRefresh,
                )
                return
            }
        },
        { isActive },
    )
}
