import { describe, expect, test } from 'bun:test'

import { computeDiffRows } from '../src/components/file-diff/diff-compute'

const CR_GLYPH = '\u240D'

function collectChangedCells(rows: ReturnType<typeof computeDiffRows>): {
    left: string[]
    right: string[]
} {
    const left: string[] = []
    const right: string[] = []
    for (const row of rows) {
        if (row.kind !== 'split') continue
        if (row.left.type !== 'blank') left.push(row.left.content)
        if (row.right.type !== 'blank') right.push(row.right.content)
    }
    return { left, right }
}

describe('computeDiffRows — line-ending handling', () => {
    test('CRLF vs LF with otherwise identical content yields changes with raw \\r preserved on the CRLF side', () => {
        const left = 'a\nb\nc\n'
        const right = 'a\r\nb\r\nc\r\n'
        const rows = computeDiffRows(left, right, 'l', 'r')

        const hasChange = rows.some(
            (row) =>
                row.kind === 'split'
                && (row.left.type === 'changed'
                    || row.right.type === 'changed'
                    || row.left.type === 'removed'
                    || row.right.type === 'added'),
        )
        expect(hasChange).toBe(true)

        const { left: leftCells, right: rightCells } = collectChangedCells(rows)
        const rightHasCr = rightCells.some((s) => s.includes('\r'))
        expect(rightHasCr).toBe(true)

        const leftHasCr = leftCells.some((s) => s.includes('\r'))
        expect(leftHasCr).toBe(false)

        const noGlyphInData = [...leftCells, ...rightCells].every(
            (s) => !s.includes(CR_GLYPH),
        )
        expect(noGlyphInData).toBe(true)
    })

    test('identical LF content produces no hunks', () => {
        const same = 'a\nb\nc\n'
        const rows = computeDiffRows(same, same, 'l', 'r')
        const changes = rows.filter(
            (row) =>
                row.kind === 'split'
                && (row.left.type !== 'context'
                    || row.right.type !== 'context'),
        )
        expect(changes.length).toBe(0)
    })
})
