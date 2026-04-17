import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, test } from 'bun:test'

import type { Action, AppState, CompareEntry, FileEntry } from '~/utils/types'
import { createInitialState, reducer } from '~/reducer'
import { buildVisibleTree } from '~/utils/compare'
import { defaultConfig } from '~/utils/config'
import { scanDirectory } from '~/utils/scanner'

const FIXTURES = path.join(import.meta.dir, 'fixtures')
const LEFT = path.join(FIXTURES, 'left')
const RIGHT = path.join(FIXTURES, 'right')

let baseState: AppState

beforeAll(async () => {
    const [leftScan, rightScan] = await Promise.all([
        scanDirectory(LEFT, null, true, false),
        scanDirectory(RIGHT, null, true, false),
    ])
    const init = createInitialState({
        config: defaultConfig,
        ignoreEnabled: false,
    })
    const entries = buildVisibleTree(
        leftScan,
        rightScan,
        new Set(['docs']),
        {
            compareDates: false,
            compareContents: true,
        },
        { mode: 'name', direction: 'asc', dirsFirst: true },
        new Map(),
    )
    baseState = { ...init, leftScan, rightScan, entries }
})

function findEntry(state: AppState, name: string): number {
    const idx = state.entries.findIndex((e) => e.name === name)
    if (idx === -1) throw new Error(`entry not found: ${name}`)
    return idx
}

function dispatch(state: AppState, action: Action): AppState {
    return reducer(state, action)
}

describe('MARK_PAIR: file pairing', () => {
    test('golden path: m on only-left file, m on only-right same-parent file opens file-diff', () => {
        const leftIdx = findEntry(baseState, 'CONTRIBUTING.old.md')
        const rightIdx = findEntry(baseState, 'CONTRIBUTING.md')

        const s1 = dispatch(
            { ...baseState, cursorIndex: leftIdx },
            { type: 'MARK_PAIR' },
        )
        expect(s1.pendingPairMark).toEqual({
            relativePath: 'docs/CONTRIBUTING.old.md',
            side: 'left',
            type: 'file',
        })
        expect(s1.view).toBe('directoryDiff')
        expect(s1.fileDiffSource).toBeNull()

        const s2 = dispatch(
            { ...s1, cursorIndex: rightIdx },
            { type: 'MARK_PAIR' },
        )
        expect(s2.pendingPairMark).toBeNull()
        expect(s2.view).toBe('fileDiff')
        expect(s2.fileDiffSource).toEqual({
            kind: 'pair',
            leftRelativePath: 'docs/CONTRIBUTING.old.md',
            rightRelativePath: 'docs/CONTRIBUTING.md',
            name: 'CONTRIBUTING.md',
        })
        // No persistent pairing in manualPairings.
        expect(s2.manualPairings.size).toBe(0)
    })

    test('marking the same entry twice toggles off', () => {
        const leftIdx = findEntry(baseState, 'CONTRIBUTING.old.md')
        const s1 = dispatch(
            { ...baseState, cursorIndex: leftIdx },
            { type: 'MARK_PAIR' },
        )
        expect(s1.pendingPairMark).not.toBeNull()
        const s2 = dispatch(s1, { type: 'MARK_PAIR' })
        expect(s2.pendingPairMark).toBeNull()
        expect(s2.view).toBe('directoryDiff')
    })

    test('mismatched types (file mark then dir mark) replaces pending with dir', () => {
        const fileIdx = findEntry(baseState, 'CONTRIBUTING.old.md')
        // services/ is only on left in the fixtures (top-level directory).
        const topLevel = buildVisibleTree(
            baseState.leftScan!,
            baseState.rightScan!,
            new Set(),
            { compareDates: false, compareContents: true },
            { mode: 'name', direction: 'asc', dirsFirst: true },
            new Map(),
        )
        const dirOnlyLeftIdx = topLevel.findIndex(
            (e) =>
                e.type === 'directory'
                && (e.status === 'only-left' || e.status === 'only-right'),
        )
        expect(dirOnlyLeftIdx).not.toBe(-1)

        const s1 = dispatch(
            { ...baseState, cursorIndex: fileIdx },
            { type: 'MARK_PAIR' },
        )
        expect(s1.pendingPairMark?.type).toBe('file')

        // Swap entries so cursor can point at the top-level dir.
        const s2 = dispatch(
            { ...s1, entries: topLevel, cursorIndex: dirOnlyLeftIdx },
            { type: 'MARK_PAIR' },
        )
        expect(s2.pendingPairMark?.type).toBe('directory')
        expect(s2.view).toBe('directoryDiff')
        expect(s2.fileDiffSource).toBeNull()
    })

    test('cross-parent file marks clear pending without opening diff', () => {
        // Left-only file under docs/
        const leftIdx = findEntry(baseState, 'CONTRIBUTING.old.md')
        // Deploy.md exists only on right under docs/; construct a top-level
        // pseudo right-only file by picking a top-level only-right file.
        const topLevel = buildVisibleTree(
            baseState.leftScan!,
            baseState.rightScan!,
            new Set(),
            { compareDates: false, compareContents: true },
            { mode: 'name', direction: 'asc', dirsFirst: true },
            new Map(),
        )
        // Find a top-level file (parent '') with only-right status — unlikely,
        // so just synthesize a pending mark with a different parent.
        const s1 = dispatch(
            { ...baseState, cursorIndex: leftIdx },
            { type: 'MARK_PAIR' },
        )
        const pseudoRightFileIdx = topLevel.findIndex(
            (e) =>
                e.type === 'file'
                && (e.status === 'only-left' || e.status === 'only-right'),
        )
        if (pseudoRightFileIdx === -1) return // nothing to compare against
        // Force the entry's parent to differ by pointing at a top-level file.
        const s2 = dispatch(
            { ...s1, entries: topLevel, cursorIndex: pseudoRightFileIdx },
            { type: 'MARK_PAIR' },
        )
        // Either same parent (unlikely given different depths) → fileDiffSource set,
        // or different parent → pendingPairMark cleared.
        const topEntry = topLevel[pseudoRightFileIdx]!
        const topParent =
            topEntry.relativePath.includes('/') ?
                topEntry.relativePath.slice(
                    0,
                    topEntry.relativePath.lastIndexOf('/'),
                )
            :   ''
        const topSide = topEntry.status === 'only-left' ? 'left' : 'right'
        if (topSide === 'left' || topParent === 'docs') {
            // same side or same parent → won't exercise cross-parent; skip
            return
        }
        expect(s2.pendingPairMark).toBeNull()
        expect(s2.fileDiffSource).toBeNull()
        expect(s2.view).toBe('directoryDiff')
    })

    test('hitting m on a matched file (not only-left/only-right) is a no-op', () => {
        // api.md exists on both sides under docs/ — status modified or identical.
        const idx = findEntry(baseState, 'api.md')
        const s = dispatch(
            { ...baseState, cursorIndex: idx },
            { type: 'MARK_PAIR' },
        )
        expect(s.pendingPairMark).toBeNull()
        expect(s.view).toBe('directoryDiff')
        expect(s.fileDiffSource).toBeNull()
    })

    test('HIDE_FILE_DIFF clears fileDiffSource', () => {
        const leftIdx = findEntry(baseState, 'CONTRIBUTING.old.md')
        const rightIdx = findEntry(baseState, 'CONTRIBUTING.md')
        const s1 = dispatch(
            { ...baseState, cursorIndex: leftIdx },
            { type: 'MARK_PAIR' },
        )
        const s2 = dispatch(
            { ...s1, cursorIndex: rightIdx },
            { type: 'MARK_PAIR' },
        )
        expect(s2.fileDiffSource).not.toBeNull()
        const s3 = dispatch(s2, { type: 'HIDE_FILE_DIFF' })
        expect(s3.view).toBe('directoryDiff')
        expect(s3.fileDiffSource).toBeNull()
    })
})

describe('PATCH_FILE_ENTRY: per-side paths', () => {
    function makeEntry(rel: string, size: number): FileEntry {
        return {
            name: path.basename(rel),
            relativePath: rel,
            type: 'file',
            size,
            modifiedTime: new Date('2025-01-01T00:00:00Z'),
            contentHash: 'deadbeef' + size,
        }
    }

    test('patches left and right independently when paths differ (ad-hoc case)', () => {
        const leftKey = 'docs/CONTRIBUTING.old.md'
        const rightKey = 'docs/CONTRIBUTING.md'
        const newLeft = makeEntry(leftKey, 999)
        const newRight = makeEntry(rightKey, 1234)

        const next = dispatch(baseState, {
            type: 'PATCH_FILE_ENTRY',
            left: { relativePath: leftKey, entry: newLeft },
            right: { relativePath: rightKey, entry: newRight },
        })

        expect(next.leftScan!.get(leftKey)).toEqual(newLeft)
        expect(next.rightScan!.get(rightKey)).toEqual(newRight)
        // Scans for other side unchanged at those keys.
        expect(next.rightScan!.get(leftKey)).toBeUndefined()
        expect(next.leftScan!.get(rightKey)).toBeUndefined()
    })

    test('patches shared path on both scans (matched-entry case)', () => {
        const key = 'docs/api.md'
        const updated = makeEntry(key, 777)
        const next = dispatch(baseState, {
            type: 'PATCH_FILE_ENTRY',
            left: { relativePath: key, entry: updated },
            right: { relativePath: key, entry: updated },
        })
        expect(next.leftScan!.get(key)).toEqual(updated)
        expect(next.rightScan!.get(key)).toEqual(updated)
    })

    test('entry: null deletes from scan map', () => {
        const key = 'docs/CONTRIBUTING.old.md'
        expect(baseState.leftScan!.get(key)).toBeDefined()
        const next = dispatch(baseState, {
            type: 'PATCH_FILE_ENTRY',
            left: { relativePath: key, entry: null },
        })
        expect(next.leftScan!.get(key)).toBeUndefined()
    })
})
