import { describe, expect, test } from 'bun:test'

import type { AppState, FileEntry, UndoEntry } from '~/utils/types'
import { createInitialState, reducer } from '~/reducer'

const defaultConfig = {
    showHints: true,
    nerdFont: false,
    dateLocale: 'en-US',
    compareDates: true,
    compareContents: true,
    dirsFirst: true,
    diffCommand: '',
} as any

function freshState(): AppState {
    return createInitialState({
        config: defaultConfig,
        ignoreEnabled: false,
    })
}

function fileEntry(relativePath: string): FileEntry {
    return {
        name: relativePath,
        relativePath,
        isDirectory: false,
        size: 0,
        modifiedTime: new Date(0),
        contentHash: 'abc',
    }
}

describe('undo stack push semantics', () => {
    test('COPY_COMPLETE pushes exactly one undo entry', () => {
        const state = freshState()
        // seed empty scans so reducer doesn't short-circuit
        const seeded = reducer(state, {
            type: 'SCAN_COMPLETE',
            leftScan: new Map(),
            rightScan: new Map([['a.txt', fileEntry('a.txt')]]),
        })
        const undo: UndoEntry = {
            kind: 'copy',
            sourceAbsPath: '/L/a.txt',
            destAbsPath: '/R/a.txt',
            destSide: 'right',
            isDirectory: false,
            backupTrashPath: null,
        }
        const next = reducer(seeded, {
            type: 'COPY_COMPLETE',
            entries: [fileEntry('a.txt')],
            side: 'right',
            undo,
        })
        expect(next.undoStack.length).toBe(1)
        expect(next.redoStack.length).toBe(0)
    })

    test('DELETE_COMPLETE pushes exactly one undo entry', () => {
        const state = freshState()
        const undo: UndoEntry = {
            kind: 'delete',
            originalAbsPath: '/L/a.txt',
            side: 'left',
            trashPath: '/tmp/trash/1/a.txt',
            isDirectory: false,
        }
        const next = reducer(state, { type: 'DELETE_COMPLETE', undo })
        expect(next.undoStack.length).toBe(1)
    })

    test('UNDO_COMPLETE pops one entry and pushes to redo', () => {
        const state = freshState()
        const undo: UndoEntry = {
            kind: 'delete',
            originalAbsPath: '/L/a.txt',
            side: 'left',
            trashPath: '/tmp/trash/1/a.txt',
            isDirectory: false,
        }
        const withUndo = reducer(state, { type: 'DELETE_COMPLETE', undo })
        expect(withUndo.undoStack.length).toBe(1)
        const undone = reducer(withUndo, {
            type: 'UNDO_COMPLETE',
            entry: withUndo.undoStack[0]!,
        })
        expect(undone.undoStack.length).toBe(0)
        expect(undone.redoStack.length).toBe(1)
    })

    test('pair completion pushes exactly one undo entry', () => {
        const state = freshState()
        const scan: Map<string, FileEntry> = new Map([
            [
                'dirA',
                {
                    name: 'dirA',
                    relativePath: 'dirA',
                    isDirectory: true,
                    size: 0,
                    modifiedTime: new Date(0),
                    contentHash: null,
                },
            ],
        ])
        const scan2: Map<string, FileEntry> = new Map([
            [
                'dirB',
                {
                    name: 'dirB',
                    relativePath: 'dirB',
                    isDirectory: true,
                    size: 0,
                    modifiedTime: new Date(0),
                    contentHash: null,
                },
            ],
        ])
        const seeded = reducer(state, {
            type: 'SCAN_COMPLETE',
            leftScan: scan,
            rightScan: scan2,
        })
        // Cursor on first only-left entry; first MARK_PAIR sets pending
        const firstMark = reducer(seeded, { type: 'MARK_PAIR' })
        expect(firstMark.undoStack.length).toBe(0)
        expect(firstMark.pendingPairMark).not.toBeNull()
        // Move cursor to the other side entry
        const atSecond = {
            ...firstMark,
            cursorIndex: 1,
            focusedPanel: 'right' as const,
        }
        const secondMark = reducer(atSecond, { type: 'MARK_PAIR' })
        expect(secondMark.undoStack.length).toBe(1)
        expect(secondMark.manualPairings.size).toBe(1)
    })
})
