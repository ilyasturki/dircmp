import type { Dispatch } from 'react'
import type { WriteStream } from 'tty'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { useApp, useInput } from 'ink'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Action, AppState } from '~/utils/types'
import { keymap } from '~/keymap'
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

export function useDirectoryScan(
    leftDir: string,
    rightDir: string,
    dispatch: Dispatch<Action>,
) {
    const [refreshCounter, setRefreshCounter] = useState(0)

    useEffect(() => {
        Promise.all([scanDirectory(leftDir), scanDirectory(rightDir)])
            .then(([leftScan, rightScan]) => {
                dispatch({ type: 'SCAN_COMPLETE', leftScan, rightScan })
            })
            .catch((err) => {
                dispatch({ type: 'SCAN_ERROR', error: String(err) })
            })
    }, [leftDir, rightDir, refreshCounter])

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
) {
    const { exit } = useApp()
    const pendingKeyRef = useRef('')
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useInput(
        (input, key) => {
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

                const action = shortcut.effect.action

                // Intercept REFRESH: dispatch to clear state, then trigger re-scan
                if (action.type === 'REFRESH') {
                    dispatch(action)
                    onRefresh?.()
                    return
                }

                // Intercept OPEN_DIFF for files: open nvim diff instead of dispatching
                if (action.type === 'OPEN_DIFF') {
                    const entry = state.entries[state.cursorIndex]
                    if (
                        entry
                        && !entry.isDirectory
                        && entry.status !== 'identical'
                    ) {
                        const leftPath = path.join(leftDir, entry.relativePath)
                        const rightPath = path.join(
                            rightDir,
                            entry.relativePath,
                        )

                        let args: string[]
                        if (entry.status === 'only-left') {
                            args = ['-d', leftPath, '/dev/null']
                        } else if (entry.status === 'only-right') {
                            args = ['-d', '/dev/null', rightPath]
                        } else {
                            args = ['-d', leftPath, rightPath]
                        }

                        spawnSync('nvim', args, { stdio: 'inherit' })
                        process.stdout.write('\x1b[2J\x1b[H')
                        dispatch({ type: 'REDRAW' })
                        return
                    }
                }

                dispatch(action)
                return
            }
        },
        { isActive },
    )
}
