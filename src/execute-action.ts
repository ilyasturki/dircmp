import type { Dispatch } from 'react'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import type { Action, AppState, FileEntry, PanelSide } from '~/utils/types'
import { copyEntry } from '~/utils/copy'

export function executeAction(
    action: Action,
    state: AppState,
    leftDir: string,
    rightDir: string,
    dispatch: Dispatch<Action>,
    exit: () => void,
    onRefresh?: () => void,
): void {
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
            process.platform === 'darwin' ? 'pbcopy'
            : process.env.WAYLAND_DISPLAY ? 'wl-copy'
            : 'xclip'
        const args =
            process.platform === 'darwin' || process.env.WAYLAND_DISPLAY ?
                []
            :   ['-selection', 'clipboard']
        spawnSync(proc, args, {
            input: fullPath,
            stdio: ['pipe', 'ignore', 'ignore'],
        })
        return
    }

    // Intercept COPY_TO_RIGHT / COPY_TO_LEFT
    if (action.type === 'COPY_TO_RIGHT' || action.type === 'COPY_TO_LEFT') {
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
        const sourceScan = copyRight ? state.leftScan : state.rightScan
        const patchEntries: FileEntry[] = []
        if (sourceScan) {
            const sourceEntry = sourceScan.get(entry.relativePath)
            if (sourceEntry) patchEntries.push(sourceEntry)
            if (entry.isDirectory) {
                const prefix = entry.relativePath + '/'
                for (const [relPath, fe] of sourceScan) {
                    if (relPath.startsWith(prefix)) patchEntries.push(fe)
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
        if (entry && !entry.isDirectory && entry.status !== 'identical') {
            const leftPath = path.join(leftDir, entry.relativePath)
            const rightPath = path.join(rightDir, entry.relativePath)

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
}
