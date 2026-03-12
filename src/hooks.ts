import type { Dispatch } from 'react'
import type { WriteStream } from 'tty'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { useApp, useInput } from 'ink'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Action, AppState, FileEntry, PanelSide } from '~/utils/types'
import { keymap } from '~/keymap'
import { copyEntry } from '~/utils/copy'
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

                const action = shortcut.effect.action

                // Intercept REFRESH: dispatch to clear state, then trigger re-scan
                if (action.type === 'REFRESH') {
                    dispatch(action)
                    onRefresh?.()
                    return
                }

                // Intercept YANK_PATH: copy file path to clipboard
                if (action.type === 'YANK_PATH') {
                    const entry = state.entries[state.cursorIndex]
                    if (!entry) return
                    const side = state.focusedPanel
                    const baseDir = side === 'left' ? leftDir : rightDir
                    const fullPath = path.join(baseDir, entry.relativePath)
                    const proc =
                        process.platform === 'darwin' ? 'pbcopy' : 'xclip'
                    const args =
                        process.platform === 'darwin' ?
                            []
                        :   ['-selection', 'clipboard']
                    spawnSync(proc, args, { input: fullPath })
                    return
                }

                // Intercept COPY_TO_RIGHT / COPY_TO_LEFT
                if (
                    action.type === 'COPY_TO_RIGHT'
                    || action.type === 'COPY_TO_LEFT'
                ) {
                    const entry = state.entries[state.cursorIndex]
                    if (!entry || entry.status === 'identical') return

                    const copyRight = action.type === 'COPY_TO_RIGHT'
                    if (copyRight && entry.status === 'only-right') return
                    if (!copyRight && entry.status === 'only-left') return

                    const sourcePath = path.join(
                        copyRight ? leftDir : rightDir,
                        entry.relativePath,
                    )
                    const destPath = path.join(
                        copyRight ? rightDir : leftDir,
                        entry.relativePath,
                    )
                    copyEntry(sourcePath, destPath, entry.isDirectory)

                    const destSide: PanelSide = copyRight ? 'right' : 'left'
                    const sourceScan =
                        copyRight ? state.leftScan : state.rightScan
                    const patchEntries: FileEntry[] = []
                    if (sourceScan) {
                        const sourceEntry = sourceScan.get(entry.relativePath)
                        if (sourceEntry) patchEntries.push(sourceEntry)
                        if (entry.isDirectory) {
                            const prefix = entry.relativePath + '/'
                            for (const [relPath, fe] of sourceScan) {
                                if (relPath.startsWith(prefix))
                                    patchEntries.push(fe)
                            }
                        }
                    }
                    dispatch({
                        type: 'COPY_COMPLETE',
                        entries: patchEntries,
                        side: destSide,
                    })
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
