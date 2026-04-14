import { describe, expect, test } from 'bun:test'

import type { AppState, FileEntry, UndoEntry } from '~/utils/types'
import { createInitialState, reducer } from '~/reducer'
import { defaultConfig } from '~/utils/config'
import { pushUndo, UNDO_STACK_LIMIT } from '~/utils/undo'

function freshState(): AppState {
    return createInitialState({
        config: defaultConfig,
        ignoreEnabled: false,
    })
}

function fileEntry(relativePath: string, isDirectory = false): FileEntry {
    return {
        name: relativePath,
        relativePath,
        type: isDirectory ? 'directory' : 'file',
        size: 0,
        modifiedTime: new Date(0),
        contentHash: isDirectory ? null : 'abc',
    }
}

function copyUndo(
    overrides: Partial<Extract<UndoEntry, { kind: 'copy' }>> = {},
): UndoEntry {
    return {
        kind: 'copy',
        sourceAbsPath: '/L/a.txt',
        destAbsPath: '/R/a.txt',
        destSide: 'right',
        type: 'file',
        backupTrashPath: null,
        ...overrides,
    }
}

function deleteUndo(
    overrides: Partial<Extract<UndoEntry, { kind: 'delete' }>> = {},
): UndoEntry {
    return {
        kind: 'delete',
        originalAbsPath: '/L/a.txt',
        side: 'left',
        trashPath: '/tmp/trash/1/a.txt',
        type: 'file',
        ...overrides,
    }
}

describe('reducer: undo stack push semantics', () => {
    test('COPY_COMPLETE pushes exactly one entry and clears redo', () => {
        const seeded = reducer(freshState(), {
            type: 'SCAN_COMPLETE',
            leftScan: new Map(),
            rightScan: new Map([['a.txt', fileEntry('a.txt')]]),
        })
        // Seed a redoStack to verify it's cleared
        const primed = { ...seeded, redoStack: [deleteUndo()] as UndoEntry[] }
        const next = reducer(primed, {
            type: 'COPY_COMPLETE',
            entries: [fileEntry('a.txt')],
            side: 'right',
            undo: copyUndo(),
        })
        expect(next.undoStack).toHaveLength(1)
        expect(next.redoStack).toHaveLength(0)
    })

    test('DELETE_COMPLETE pushes exactly one entry and clears redo', () => {
        const primed = {
            ...freshState(),
            redoStack: [copyUndo()] as UndoEntry[],
        }
        const next = reducer(primed, {
            type: 'DELETE_COMPLETE',
            undo: deleteUndo(),
        })
        expect(next.undoStack).toHaveLength(1)
        expect(next.redoStack).toHaveLength(0)
    })

    test('DELETE_COMPLETE without undo payload leaves stacks untouched', () => {
        const primed = {
            ...freshState(),
            undoStack: [copyUndo()] as UndoEntry[],
            redoStack: [deleteUndo()] as UndoEntry[],
        }
        const next = reducer(primed, { type: 'DELETE_COMPLETE' })
        expect(next.undoStack).toHaveLength(1)
        expect(next.redoStack).toHaveLength(1)
    })
})

describe('reducer: UNDO_COMPLETE / REDO_COMPLETE', () => {
    test('UNDO_COMPLETE pops from undo and pushes to redo', () => {
        const entry = deleteUndo()
        const withUndo = reducer(freshState(), {
            type: 'DELETE_COMPLETE',
            undo: entry,
        })
        const undone = reducer(withUndo, { type: 'UNDO_COMPLETE', entry })
        expect(undone.undoStack).toHaveLength(0)
        expect(undone.redoStack).toHaveLength(1)
        expect(undone.redoStack[0]).toBe(entry)
    })

    test('REDO_COMPLETE pops from redo and pushes to undo', () => {
        const entry = deleteUndo()
        const primed = {
            ...freshState(),
            redoStack: [entry] as UndoEntry[],
        }
        const redone = reducer(primed, { type: 'REDO_COMPLETE', entry })
        expect(redone.redoStack).toHaveLength(0)
        expect(redone.undoStack).toHaveLength(1)
    })

    test('UNDO_COMPLETE for pair restores prior manualPairings', () => {
        const before = new Map<string, string>()
        const after = new Map([['dirA', 'dirB']])
        const entry: UndoEntry = {
            kind: 'pair',
            beforePairings: before,
            afterPairings: after,
            beforeExpandedDirs: new Set(),
            afterExpandedDirs: new Set(),
        }
        const primed = {
            ...freshState(),
            manualPairings: new Map(after),
            undoStack: [entry] as UndoEntry[],
        }
        const undone = reducer(primed, { type: 'UNDO_COMPLETE', entry })
        expect(undone.manualPairings.size).toBe(0)
    })

    test('REDO_COMPLETE for pair reapplies afterPairings', () => {
        const before = new Map<string, string>()
        const after = new Map([['dirA', 'dirB']])
        const entry: UndoEntry = {
            kind: 'pair',
            beforePairings: before,
            afterPairings: after,
            beforeExpandedDirs: new Set(),
            afterExpandedDirs: new Set(),
        }
        const primed = {
            ...freshState(),
            manualPairings: new Map(before),
            redoStack: [entry] as UndoEntry[],
        }
        const redone = reducer(primed, { type: 'REDO_COMPLETE', entry })
        expect(redone.manualPairings.get('dirA')).toBe('dirB')
    })
})

describe('reducer: MARK_PAIR / UNPAIR push only on real mutation', () => {
    test('first MARK_PAIR sets pending but pushes no undo', () => {
        const seeded = reducer(freshState(), {
            type: 'SCAN_COMPLETE',
            leftScan: new Map([['dirA', fileEntry('dirA', true)]]),
            rightScan: new Map([['dirB', fileEntry('dirB', true)]]),
        })
        const marked = reducer(seeded, { type: 'MARK_PAIR' })
        expect(marked.pendingPairMark).not.toBeNull()
        expect(marked.undoStack).toHaveLength(0)
    })

    test('completing pair pushes exactly one undo entry', () => {
        const seeded = reducer(freshState(), {
            type: 'SCAN_COMPLETE',
            leftScan: new Map([['dirA', fileEntry('dirA', true)]]),
            rightScan: new Map([['dirB', fileEntry('dirB', true)]]),
        })
        const firstMark = reducer(seeded, { type: 'MARK_PAIR' })
        const atSecond = { ...firstMark, cursorIndex: 1 }
        const secondMark = reducer(atSecond, { type: 'MARK_PAIR' })
        expect(secondMark.undoStack).toHaveLength(1)
        expect(secondMark.manualPairings.size).toBe(1)
    })

    test('toggle-off of pending mark does not push undo', () => {
        const seeded = reducer(freshState(), {
            type: 'SCAN_COMPLETE',
            leftScan: new Map([['dirA', fileEntry('dirA', true)]]),
            rightScan: new Map([['dirB', fileEntry('dirB', true)]]),
        })
        const marked = reducer(seeded, { type: 'MARK_PAIR' })
        const toggled = reducer(marked, { type: 'MARK_PAIR' })
        expect(toggled.pendingPairMark).toBeNull()
        expect(toggled.undoStack).toHaveLength(0)
    })
})

describe('pushUndo helper', () => {
    test('caps stack at UNDO_STACK_LIMIT, dropping oldest', () => {
        let stack: UndoEntry[] = []
        for (let i = 0; i < UNDO_STACK_LIMIT + 5; i++) {
            stack = pushUndo(stack, deleteUndo({ trashPath: `/t/${i}` }))
        }
        expect(stack).toHaveLength(UNDO_STACK_LIMIT)
        // oldest 5 entries dropped; first remaining is index 5
        const first = stack[0]
        expect(first?.kind).toBe('delete')
        if (first?.kind === 'delete') {
            expect(first.trashPath).toBe('/t/5')
        }
    })
})
