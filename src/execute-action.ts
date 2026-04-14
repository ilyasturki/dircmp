import type { Dispatch } from 'react'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import type {
    Action,
    AppState,
    FileEntry,
    PanelSide,
    UndoEntry,
} from '~/utils/types'
import { copyEntry } from '~/utils/copy'
import { moveToTrash, restoreFromTrash } from '~/utils/trash'

function isInside(absPath: string, dir: string): boolean {
    const rel = path.relative(dir, absPath)
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function sideOfPath(
    absPath: string,
    leftDir: string,
    rightDir: string,
): PanelSide | null {
    if (isInside(absPath, leftDir)) return 'left'
    if (isInside(absPath, rightDir)) return 'right'
    return null
}

export function executeAction(
    action: Action,
    state: AppState,
    leftDir: string,
    rightDir: string,
    dispatch: Dispatch<Action>,
    exit: () => void,
    onRefresh?: () => void,
    onShellOut?: (command: string, args: string[]) => void,
    onToast?: (message: string) => void,
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

    // Intercept OPEN_IN_EDITOR: launch $EDITOR on the focused entry
    if (action.type === 'OPEN_IN_EDITOR') {
        const entry = state.entries[state.cursorIndex]
        if (!entry || !onShellOut) return
        const editor = process.env.EDITOR || process.env.VISUAL
        if (!editor) return
        const side = state.focusedPanel
        const baseDir = side === 'left' ? leftDir : rightDir
        const fullPath = path.join(baseDir, entry.relativePath)
        const parts = editor.split(/\s+/)
        onShellOut(parts[0]!, [...parts.slice(1), fullPath])
        return
    }

    // Intercept COPY_TO_RIGHT / COPY_TO_LEFT / COPY_FROM_FOCUSED
    if (
        action.type === 'COPY_TO_RIGHT'
        || action.type === 'COPY_TO_LEFT'
        || action.type === 'COPY_FROM_FOCUSED'
    ) {
        const entry = state.entries[state.cursorIndex]
        if (!entry || entry.status === 'identical') return

        const copyRight =
            action.type === 'COPY_FROM_FOCUSED' ?
                state.focusedPanel === 'left'
            :   action.type === 'COPY_TO_RIGHT'

        // When the source side is empty (copying "nothing" to the dest side),
        // delete the dest side instead — the dest should mirror the empty source.
        const deleteDest =
            (copyRight && entry.status === 'only-right')
            || (!copyRight && entry.status === 'only-left')

        if (deleteDest) {
            const destSide: PanelSide = copyRight ? 'right' : 'left'
            const destRelPath =
                destSide === 'right' ?
                    (entry.right?.relativePath ?? entry.relativePath)
                :   (entry.left?.relativePath ?? entry.relativePath)
            const destPath = path.join(
                destSide === 'right' ? rightDir : leftDir,
                destRelPath,
            )
            if (!fs.existsSync(destPath)) return
            const trashPath = moveToTrash(destPath)
            const undo: UndoEntry = {
                kind: 'delete',
                originalAbsPath: destPath,
                side: destSide,
                trashPath,
                type: entry.type,
            }
            dispatch({ type: 'DELETE_COMPLETE', undo })
            onRefresh?.()
            return
        }

        const sourceRelPath =
            copyRight ?
                (entry.left?.relativePath ?? entry.relativePath)
            :   (entry.right?.relativePath ?? entry.relativePath)
        const destRelPath =
            copyRight ?
                (entry.right?.relativePath ?? entry.relativePath)
            :   (entry.left?.relativePath ?? entry.relativePath)
        const sourcePath = path.join(
            copyRight ? leftDir : rightDir,
            sourceRelPath,
        )
        const destPath = path.join(copyRight ? rightDir : leftDir, destRelPath)

        let backupTrashPath: string | null = null
        if (fs.existsSync(destPath)) {
            backupTrashPath = moveToTrash(destPath)
        }
        copyEntry(sourcePath, destPath, entry.type)

        const destSide: PanelSide = copyRight ? 'right' : 'left'
        const sourceScan = copyRight ? state.leftScan : state.rightScan
        const patchEntries: FileEntry[] = []
        if (sourceScan) {
            const sourceEntry = sourceScan.get(entry.relativePath)
            if (sourceEntry) patchEntries.push(sourceEntry)
            if (entry.type === 'directory') {
                const prefix = entry.relativePath + '/'
                for (const [relPath, fe] of sourceScan) {
                    if (relPath.startsWith(prefix)) patchEntries.push(fe)
                }
            }
        }
        const undo: UndoEntry = {
            kind: 'copy',
            sourceAbsPath: sourcePath,
            destAbsPath: destPath,
            destSide,
            type: entry.type,
            backupTrashPath,
        }
        dispatch({
            type: 'COPY_COMPLETE',
            entries: patchEntries,
            side: destSide,
            undo,
        })
        return
    }

    // Intercept UNDO
    if (action.type === 'UNDO') {
        const top = state.undoStack[state.undoStack.length - 1]
        if (!top) {
            onToast?.('Nothing to undo')
            return
        }
        if (top.kind === 'copy') {
            if (!sideOfPath(top.destAbsPath, leftDir, rightDir)) {
                onToast?.('Cannot undo: directories changed')
                return
            }
            fs.rmSync(top.destAbsPath, { recursive: true, force: true })
            if (top.backupTrashPath) {
                restoreFromTrash(top.backupTrashPath, top.destAbsPath)
            }
            dispatch({ type: 'UNDO_COMPLETE', entry: top })
            onRefresh?.()
            return
        }
        if (top.kind === 'delete') {
            if (!sideOfPath(top.originalAbsPath, leftDir, rightDir)) {
                onToast?.('Cannot undo: directories changed')
                return
            }
            restoreFromTrash(top.trashPath, top.originalAbsPath)
            dispatch({ type: 'UNDO_COMPLETE', entry: top })
            onRefresh?.()
            return
        }
        // pair / unpair
        dispatch({ type: 'UNDO_COMPLETE', entry: top })
        return
    }

    // Intercept REDO
    if (action.type === 'REDO') {
        const top = state.redoStack[state.redoStack.length - 1]
        if (!top) {
            onToast?.('Nothing to redo')
            return
        }
        if (top.kind === 'copy') {
            if (!sideOfPath(top.destAbsPath, leftDir, rightDir)) {
                onToast?.('Cannot redo: directories changed')
                return
            }
            let backupTrashPath: string | null = null
            if (fs.existsSync(top.destAbsPath)) {
                backupTrashPath = moveToTrash(top.destAbsPath)
            }
            copyEntry(top.sourceAbsPath, top.destAbsPath, top.type)
            dispatch({
                type: 'REDO_COMPLETE',
                entry: { ...top, backupTrashPath },
            })
            onRefresh?.()
            return
        }
        if (top.kind === 'delete') {
            if (!sideOfPath(top.originalAbsPath, leftDir, rightDir)) {
                onToast?.('Cannot redo: directories changed')
                return
            }
            const trashPath = moveToTrash(top.originalAbsPath)
            dispatch({
                type: 'REDO_COMPLETE',
                entry: { ...top, trashPath },
            })
            onRefresh?.()
            return
        }
        // pair / unpair
        dispatch({ type: 'REDO_COMPLETE', entry: top })
        return
    }

    // Intercept OPEN_FILE_DIFF for files: use external diff command or built-in viewer
    if (action.type === 'OPEN_FILE_DIFF') {
        const entry = state.entries[state.cursorIndex]
        if (entry && entry.type === 'file') {
            const diffCmd = state.config.diffCommand?.trim()
            if (diffCmd && onShellOut) {
                const leftPath = path.join(leftDir, entry.relativePath)
                const rightPath = path.join(rightDir, entry.relativePath)
                const parts = diffCmd.split(/\s+/)
                onShellOut(parts[0]!, [...parts.slice(1), leftPath, rightPath])
                return
            }
            dispatch({
                type: 'SHOW_FILE_DIFF',
                entryIndex: state.cursorIndex,
            })
            return
        }
    }

    dispatch(action)
}
