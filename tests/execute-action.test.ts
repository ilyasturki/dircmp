import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, test } from 'bun:test'

import type { Action, AppState, UndoEntry } from '~/utils/types'
import { executeAction } from '~/execute-action'
import { createInitialState } from '~/reducer'
import { defaultConfig } from '~/utils/config'

// Point trash session at an isolated tmp cache before loading the module.
const TMP_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'dircmp-exec-test-'))
process.env.XDG_CACHE_HOME = TMP_CACHE

const { initTrashSession, moveToTrash } = await import('~/utils/trash')

function tmpPair(): { leftDir: string; rightDir: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dircmp-exec-pair-'))
    const leftDir = path.join(root, 'left')
    const rightDir = path.join(root, 'right')
    fs.mkdirSync(leftDir)
    fs.mkdirSync(rightDir)
    return { leftDir, rightDir }
}

function stateWith(
    stack: UndoEntry[],
    which: 'undo' | 'redo' = 'undo',
): AppState {
    const base = createInitialState({
        config: defaultConfig,
        ignoreEnabled: false,
    })
    return which === 'undo' ?
            { ...base, undoStack: stack }
        :   { ...base, redoStack: stack }
}

interface Captured {
    actions: Action[]
    toasts: string[]
    refreshCount: () => number
    dispatch: (a: Action) => void
    onRefresh: () => void
    onToast: (m: string) => void
}

function captures(): Captured {
    const actions: Action[] = []
    const toasts: string[] = []
    let refreshes = 0
    return {
        actions,
        toasts,
        refreshCount: () => refreshes,
        dispatch: (a) => actions.push(a),
        onRefresh: () => {
            refreshes++
        },
        onToast: (m) => toasts.push(m),
    }
}

describe('executeAction: UNDO branch', () => {
    beforeAll(() => initTrashSession())

    test('empty stack emits a toast and does nothing', () => {
        const { leftDir, rightDir } = tmpPair()
        const c = captures()
        executeAction(
            { type: 'UNDO' },
            stateWith([]),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(c.toasts).toEqual(['Nothing to undo'])
        expect(c.actions).toHaveLength(0)
        expect(c.refreshCount()).toBe(0)
    })

    test('undo of copy (no backup) deletes dest and triggers refresh', () => {
        const { leftDir, rightDir } = tmpPair()
        // Simulate that a copy just happened: file exists on right
        const dest = path.join(rightDir, 'a.txt')
        fs.writeFileSync(dest, 'source content')

        const entry: UndoEntry = {
            kind: 'copy',
            sourceAbsPath: path.join(leftDir, 'a.txt'),
            destAbsPath: dest,
            destSide: 'right',
            type: 'file',
            backupTrashPath: null,
        }
        const c = captures()
        executeAction(
            { type: 'UNDO' },
            stateWith([entry]),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(fs.existsSync(dest)).toBe(false)
        expect(c.actions).toEqual([{ type: 'UNDO_COMPLETE', entry }])
        expect(c.refreshCount()).toBe(1)
        expect(c.toasts).toHaveLength(0)
    })

    test('undo of copy (with backup) restores the overwritten original', () => {
        const { leftDir, rightDir } = tmpPair()
        // right/a.txt has been "overwritten" by the copy; original was trashed.
        const dest = path.join(rightDir, 'a.txt')
        // Create original content, stash it in trash (simulating the pre-copy backup).
        const origPath = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), 'orig-')),
            'a.txt',
        )
        fs.writeFileSync(origPath, 'original')
        const backupTrashPath = moveToTrash(origPath)
        // Now write the "copied" content at dest.
        fs.writeFileSync(dest, 'copied content')

        const entry: UndoEntry = {
            kind: 'copy',
            sourceAbsPath: path.join(leftDir, 'a.txt'),
            destAbsPath: dest,
            destSide: 'right',
            type: 'file',
            backupTrashPath,
        }
        const c = captures()
        executeAction(
            { type: 'UNDO' },
            stateWith([entry]),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(fs.readFileSync(dest, 'utf8')).toBe('original')
        expect(fs.existsSync(backupTrashPath)).toBe(false)
        expect(c.actions).toEqual([{ type: 'UNDO_COMPLETE', entry }])
    })

    test('undo of delete restores the file from trash', () => {
        const { leftDir, rightDir } = tmpPair()
        // Create a file, then move it to trash to simulate a delete.
        const orig = path.join(leftDir, 'deleted.txt')
        fs.writeFileSync(orig, 'i was deleted')
        const trashPath = moveToTrash(orig)
        expect(fs.existsSync(orig)).toBe(false)

        const entry: UndoEntry = {
            kind: 'delete',
            originalAbsPath: orig,
            side: 'left',
            trashPath,
            type: 'file',
        }
        const c = captures()
        executeAction(
            { type: 'UNDO' },
            stateWith([entry]),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(fs.readFileSync(orig, 'utf8')).toBe('i was deleted')
        expect(fs.existsSync(trashPath)).toBe(false)
        expect(c.actions).toEqual([{ type: 'UNDO_COMPLETE', entry }])
        expect(c.refreshCount()).toBe(1)
    })

    test('undo rejects entries whose path lies outside both dirs', () => {
        const { leftDir, rightDir } = tmpPair()
        const entry: UndoEntry = {
            kind: 'delete',
            originalAbsPath: '/definitely/not/inside/left/or/right.txt',
            side: 'left',
            trashPath: '/tmp/whatever',
            type: 'file',
        }
        const c = captures()
        executeAction(
            { type: 'UNDO' },
            stateWith([entry]),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(c.actions).toHaveLength(0)
        expect(c.toasts).toEqual(['Cannot undo: directories changed'])
    })

    test('undo of pair dispatches UNDO_COMPLETE without fs work or refresh', () => {
        const { leftDir, rightDir } = tmpPair()
        const entry: UndoEntry = {
            kind: 'pair',
            beforePairings: new Map(),
            afterPairings: new Map([['dirA', 'dirB']]),
            beforeExpandedDirs: new Set(),
            afterExpandedDirs: new Set(),
        }
        const c = captures()
        executeAction(
            { type: 'UNDO' },
            stateWith([entry]),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(c.actions).toEqual([{ type: 'UNDO_COMPLETE', entry }])
        expect(c.refreshCount()).toBe(0)
    })
})

describe('executeAction: REDO branch', () => {
    beforeAll(() => initTrashSession())

    test('empty stack emits a toast', () => {
        const { leftDir, rightDir } = tmpPair()
        const c = captures()
        executeAction(
            { type: 'REDO' },
            stateWith([], 'redo'),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(c.toasts).toEqual(['Nothing to redo'])
    })

    test('redo of copy re-performs the copy and reports a new backup path', () => {
        const { leftDir, rightDir } = tmpPair()
        const src = path.join(leftDir, 'a.txt')
        const dest = path.join(rightDir, 'a.txt')
        fs.writeFileSync(src, 'source v2')
        fs.writeFileSync(dest, 'existing on right') // will be backed up

        const entry: UndoEntry = {
            kind: 'copy',
            sourceAbsPath: src,
            destAbsPath: dest,
            destSide: 'right',
            type: 'file',
            backupTrashPath: null, // stale — redo should compute fresh
        }
        const c = captures()
        executeAction(
            { type: 'REDO' },
            stateWith([entry], 'redo'),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(fs.readFileSync(dest, 'utf8')).toBe('source v2')
        expect(c.actions).toHaveLength(1)
        const dispatched = c.actions[0]!
        expect(dispatched.type).toBe('REDO_COMPLETE')
        if (
            dispatched.type === 'REDO_COMPLETE'
            && dispatched.entry.kind === 'copy'
        ) {
            expect(dispatched.entry.backupTrashPath).not.toBeNull()
            expect(
                fs.readFileSync(dispatched.entry.backupTrashPath!, 'utf8'),
            ).toBe('existing on right')
        }
    })

    test('redo of delete moves the file back to a fresh trash location', () => {
        const { leftDir, rightDir } = tmpPair()
        const orig = path.join(leftDir, 'b.txt')
        fs.writeFileSync(orig, 'redo-me')

        const entry: UndoEntry = {
            kind: 'delete',
            originalAbsPath: orig,
            side: 'left',
            trashPath: '/stale/path',
            type: 'file',
        }
        const c = captures()
        executeAction(
            { type: 'REDO' },
            stateWith([entry], 'redo'),
            leftDir,
            rightDir,
            c.dispatch,
            () => {},
            c.onRefresh,
            undefined,
            c.onToast,
        )
        expect(fs.existsSync(orig)).toBe(false)
        expect(c.actions).toHaveLength(1)
        const dispatched = c.actions[0]!
        if (
            dispatched.type === 'REDO_COMPLETE'
            && dispatched.entry.kind === 'delete'
        ) {
            expect(dispatched.entry.trashPath).not.toBe('/stale/path')
            expect(fs.readFileSync(dispatched.entry.trashPath, 'utf8')).toBe(
                'redo-me',
            )
        }
    })
})
