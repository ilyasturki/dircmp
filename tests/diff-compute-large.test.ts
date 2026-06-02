import { describe, expect, test } from 'bun:test'

import {
    buildCoarseDiffRows,
    computeDiffRows,
} from '../src/components/file-diff/diff-compute'

describe('buildCoarseDiffRows', () => {
    test('trims common prefix/suffix and pairs the differing middle', () => {
        const rows = buildCoarseDiffRows('head\nA\nB\nfoot', 'head\nX\nY\nfoot')
        // 1 common prefix line (head) collapses into the header's skipped count;
        // 1 common suffix line (foot) is dropped.
        expect(rows[0]).toEqual({ kind: 'hunk-header', skipped: 1 })
        const changed = rows.filter((r) => r.kind === 'split')
        expect(changed).toEqual([
            {
                kind: 'split',
                left: { type: 'changed', lineNum: 2, content: 'A' },
                right: { type: 'changed', lineNum: 2, content: 'X' },
            },
            {
                kind: 'split',
                left: { type: 'changed', lineNum: 3, content: 'B' },
                right: { type: 'changed', lineNum: 3, content: 'Y' },
            },
        ])
    })

    test('uneven middles spill into removed-only / added-only rows', () => {
        const rows = buildCoarseDiffRows('head\nA\nB\nC\nfoot', 'head\nX\nfoot')
        const splits = rows.filter((r) => r.kind === 'split')
        // A↔X paired; B and C have no counterpart -> removed with a blank right.
        expect(splits[0]!.left.type).toBe('changed')
        expect(splits[1]!.left.type).toBe('removed')
        expect(splits[1]!.right.type).toBe('blank')
        expect(splits[2]!.left.type).toBe('removed')
        expect(splits[2]!.right.type).toBe('blank')
    })

    test('an empty side yields added/removed-only rows, no phantom line', () => {
        // ''.split('\n') is [''], which would wrongly pair an empty line against
        // the present side's first line for an only-left/only-right file.
        const right = Array.from({ length: 5 }, (_, i) => `new ${i}`).join('\n')
        const splits = buildCoarseDiffRows('', right).filter(
            (r) => r.kind === 'split',
        )
        expect(splits.length).toBe(5)
        expect(
            splits.every(
                (r) =>
                    r.kind === 'split'
                    && r.left.type === 'blank'
                    && r.right.type === 'added',
            ),
        ).toBe(true)
    })
})

describe('computeDiffRows — cost guard', () => {
    test('a large file with scattered edits keeps the real (non-coarse) diff', () => {
        // 8000 lines, 100 edits (edit distance ~200). The wall-clock guard lets
        // this finish in a few ms as a real multi-hunk diff. Regression test: the
        // earlier lineCount×editDistance cap (≈187 here) wrongly bailed it to a
        // single coarse block — the everyday "big file, modest edits" case.
        const base = Array.from(
            { length: 8000 },
            (_, i) => `line content number ${i}`,
        )
        const a = base.join('\n')
        const b = base
            .map((l, i) => (i % 80 === 0 ? l + ' EDITED' : l))
            .join('\n')
        const rows = computeDiffRows(a, b, 'x', 'x')
        const hunkHeaders = rows.filter((r) => r.kind === 'hunk-header')
        expect(hunkHeaders.length).toBeGreaterThan(10)
        expect(
            rows.some((r) => r.kind === 'split' && r.left.type === 'context'),
        ).toBe(true)
    })

    test('genuinely huge/different files bail fast instead of grinding for seconds', () => {
        const a = Array.from({ length: 5000 }, (_, i) => `pkg-${i}-aaa`).join(
            '\n',
        )
        const b = Array.from({ length: 5000 }, (_, i) => `pkg-${i}-zzz`).join(
            '\n',
        )
        const start = performance.now()
        const rows = computeDiffRows(a, b, 'x', 'x')
        const elapsed = performance.now() - start
        // Unbounded Myers took multiple seconds here; the wall-clock timeout
        // aborts well under a second (it returns the coarse fallback).
        expect(elapsed).toBeLessThan(800)
        expect(rows.length).toBeGreaterThan(0)
    })

    test('large but identical content is still detected as identical', () => {
        const same = Array.from({ length: 4000 }, (_, i) => `line-${i}`).join(
            '\n',
        )
        // Identical files diff in O(0) and never time out -> 0 hunks -> [].
        expect(computeDiffRows(same, same, 'x', 'x')).toEqual([])
    })

    test('large files with a single change keep the full line diff', () => {
        const base = Array.from({ length: 4000 }, (_, i) => `line-${i}`)
        const a = base.join('\n')
        const b = base
            .map((l, i) => (i === 2000 ? l + '-edited' : l))
            .join('\n')
        const rows = computeDiffRows(a, b, 'x', 'x')
        // Real diff with context rows, not the coarse fallback.
        expect(
            rows.some((r) => r.kind === 'split' && r.left.type === 'context'),
        ).toBe(true)
        const changed = rows.filter(
            (r) => r.kind === 'split' && r.left.type === 'changed',
        )
        expect(changed.length).toBe(1)
    })
})
