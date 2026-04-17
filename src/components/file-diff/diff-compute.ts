import { diffWordsWithSpace, structuredPatch } from 'diff'

export type CellType = 'context' | 'added' | 'removed' | 'blank' | 'changed'

export interface Segment {
    text: string
    changed: boolean
}

export interface DiffCell {
    type: CellType
    lineNum: number | null
    content: string
    segments?: Segment[]
}

export type DiffRow =
    | { kind: 'split'; left: DiffCell; right: DiffCell }
    | { kind: 'hunk-header'; skipped: number }

export interface HunkRange {
    start: number
    end: number
}

const PAIR_SIMILARITY_THRESHOLD = 0.4

export const BLANK_CELL: DiffCell = {
    type: 'blank',
    lineNum: null,
    content: '',
}

function buildPairedSegments(
    left: string,
    right: string,
): { leftSegs: Segment[]; rightSegs: Segment[]; similarity: number } {
    const parts = diffWordsWithSpace(left, right)
    const leftSegs: Segment[] = []
    const rightSegs: Segment[] = []
    let commonChars = 0
    let leftChars = 0
    let rightChars = 0
    for (const p of parts) {
        const len = p.value.length
        if (p.added) {
            rightSegs.push({ text: p.value, changed: true })
            rightChars += len
        } else if (p.removed) {
            leftSegs.push({ text: p.value, changed: true })
            leftChars += len
        } else {
            leftSegs.push({ text: p.value, changed: false })
            rightSegs.push({ text: p.value, changed: false })
            commonChars += len
            leftChars += len
            rightChars += len
        }
    }
    const denom = Math.max(leftChars, rightChars)
    const similarity = denom === 0 ? 1 : commonChars / denom
    return { leftSegs, rightSegs, similarity }
}

function flushChangeBlock(
    removed: { lineNum: number; content: string }[],
    added: { lineNum: number; content: string }[],
    rows: DiffRow[],
): void {
    const paired = Math.min(removed.length, added.length)
    for (let i = 0; i < paired; i++) {
        const r = removed[i]
        const a = added[i]
        const { leftSegs, rightSegs, similarity } = buildPairedSegments(
            r.content,
            a.content,
        )
        if (similarity >= PAIR_SIMILARITY_THRESHOLD) {
            rows.push({
                kind: 'split',
                left: {
                    type: 'changed',
                    lineNum: r.lineNum,
                    content: r.content,
                    segments: leftSegs,
                },
                right: {
                    type: 'changed',
                    lineNum: a.lineNum,
                    content: a.content,
                    segments: rightSegs,
                },
            })
        } else {
            rows.push({
                kind: 'split',
                left: {
                    type: 'changed',
                    lineNum: r.lineNum,
                    content: r.content,
                },
                right: {
                    type: 'changed',
                    lineNum: a.lineNum,
                    content: a.content,
                },
            })
        }
    }
    for (let i = paired; i < removed.length; i++) {
        rows.push({
            kind: 'split',
            left: {
                type: 'removed',
                lineNum: removed[i].lineNum,
                content: removed[i].content,
            },
            right: BLANK_CELL,
        })
    }
    for (let i = paired; i < added.length; i++) {
        rows.push({
            kind: 'split',
            left: BLANK_CELL,
            right: {
                type: 'added',
                lineNum: added[i].lineNum,
                content: added[i].content,
            },
        })
    }
}

export const DEFAULT_DIFF_CONTEXT = 3

export function computeDiffRows(
    leftContent: string,
    rightContent: string,
    leftName: string,
    rightName: string,
    context: number = DEFAULT_DIFF_CONTEXT,
): DiffRow[] {
    const patch = structuredPatch(
        leftName,
        rightName,
        leftContent,
        rightContent,
        undefined,
        undefined,
        { context: Math.max(0, context) },
    )

    const rows: DiffRow[] = []
    let prevHunkEndOld = 0
    for (const hunk of patch.hunks) {
        const skipped = Math.max(0, hunk.oldStart - 1 - prevHunkEndOld)
        rows.push({ kind: 'hunk-header', skipped })
        prevHunkEndOld = hunk.oldStart + hunk.oldLines - 1

        let leftNum = hunk.oldStart
        let rightNum = hunk.newStart
        let removedBuf: { lineNum: number; content: string }[] = []
        let addedBuf: { lineNum: number; content: string }[] = []
        const flush = () => {
            if (removedBuf.length || addedBuf.length) {
                flushChangeBlock(removedBuf, addedBuf, rows)
                removedBuf = []
                addedBuf = []
            }
        }
        for (const line of hunk.lines) {
            const prefix = line[0]
            const content = line.slice(1)
            if (prefix === '-') {
                removedBuf.push({ lineNum: leftNum++, content })
            } else if (prefix === '+') {
                addedBuf.push({ lineNum: rightNum++, content })
            } else {
                flush()
                rows.push({
                    kind: 'split',
                    left: { type: 'context', lineNum: leftNum++, content },
                    right: { type: 'context', lineNum: rightNum++, content },
                })
            }
        }
        flush()
    }
    return rows
}

function isChangeRow(row: DiffRow): boolean {
    if (row.kind !== 'split') return false
    return (
        row.left.type === 'added'
        || row.left.type === 'removed'
        || row.left.type === 'changed'
        || row.right.type === 'added'
        || row.right.type === 'removed'
        || row.right.type === 'changed'
    )
}

export function computeChangeLineIndices(diffRows: DiffRow[] | null): number[] {
    if (!diffRows) return []
    const out: number[] = []
    for (let i = 0; i < diffRows.length; i++) {
        if (isChangeRow(diffRows[i])) out.push(i)
    }
    return out
}

export function computeHunkRanges(diffRows: DiffRow[] | null): HunkRange[] {
    if (!diffRows || diffRows.length === 0) return []
    const ranges: HunkRange[] = []
    let blockStart = -1
    for (let i = 0; i < diffRows.length; i++) {
        if (isChangeRow(diffRows[i])) {
            if (blockStart === -1) blockStart = i
        } else if (blockStart !== -1) {
            ranges.push({ start: blockStart, end: i - 1 })
            blockStart = -1
        }
    }
    if (blockStart !== -1) {
        ranges.push({ start: blockStart, end: diffRows.length - 1 })
    }
    return ranges
}

export function applyHunkToContent(
    diffRows: DiffRow[],
    hunkRange: HunkRange,
    targetContent: string,
    direction: 'toLeft' | 'toRight',
): string {
    const sourceKey = direction === 'toRight' ? 'left' : 'right'
    const targetKey = direction === 'toRight' ? 'right' : 'left'

    const sourceLines: string[] = []
    let targetMin: number | null = null
    let targetMax: number | null = null
    for (let i = hunkRange.start; i <= hunkRange.end; i++) {
        const row = diffRows[i]
        if (!row || row.kind !== 'split') continue
        const src = row[sourceKey]
        const tgt = row[targetKey]
        if (src.type !== 'blank') sourceLines.push(src.content)
        if (tgt.type !== 'blank' && tgt.lineNum !== null) {
            if (targetMin === null || tgt.lineNum < targetMin)
                targetMin = tgt.lineNum
            if (targetMax === null || tgt.lineNum > targetMax)
                targetMax = tgt.lineNum
        }
    }

    const targetLines = targetContent.split('\n')
    let insertIdx: number
    let deleteCount: number
    if (targetMin !== null && targetMax !== null) {
        insertIdx = targetMin - 1
        deleteCount = targetMax - targetMin + 1
    } else {
        // Pure insertion — find the closest prior context row to anchor position
        let insertAfterLineNum: number | null = null
        for (let i = hunkRange.start - 1; i >= 0; i--) {
            const row = diffRows[i]
            if (!row || row.kind !== 'split') continue
            const tgt = row[targetKey]
            if (tgt.type !== 'blank' && tgt.lineNum !== null) {
                insertAfterLineNum = tgt.lineNum
                break
            }
        }
        insertIdx = insertAfterLineNum ?? 0
        deleteCount = 0
    }

    targetLines.splice(insertIdx, deleteCount, ...sourceLines)
    return targetLines.join('\n')
}

function sliceSegments(
    segments: Segment[],
    start: number,
    end: number,
): Segment[] {
    const out: Segment[] = []
    let offset = 0
    for (const seg of segments) {
        const segEnd = offset + seg.text.length
        if (segEnd > start && offset < end) {
            const from = Math.max(0, start - offset)
            const to = Math.min(seg.text.length, end - offset)
            out.push({ text: seg.text.slice(from, to), changed: seg.changed })
        }
        offset = segEnd
        if (offset >= end) break
    }
    return out
}

export function wrapCell(cell: DiffCell, width: number): DiffCell[] {
    if (cell.type === 'blank' || width <= 0) return [cell]
    const len = cell.content.length
    if (len <= width) return [cell]
    const parts: DiffCell[] = []
    for (let start = 0; start < len; start += width) {
        const end = Math.min(len, start + width)
        parts.push({
            type: cell.type,
            lineNum: start === 0 ? cell.lineNum : null,
            content: cell.content.slice(start, end),
            segments:
                cell.segments ?
                    sliceSegments(cell.segments, start, end)
                :   undefined,
        })
    }
    return parts
}

export interface VisualRow {
    logicalIndex: number
    isContinuation: boolean
    row: DiffRow
    left?: DiffCell
    right?: DiffCell
}

export interface VisualRowsResult {
    rows: VisualRow[]
    /** Visual row index of the first visual row for each logical index. */
    logicalToVisualStart: Int32Array
    /** Visual row index of the last visual row for each logical index. */
    logicalToVisualEnd: Int32Array
}

export function expandToVisualRows(
    diffRows: DiffRow[],
    contentWidth: number,
    wrap: boolean,
): VisualRowsResult {
    const rows: VisualRow[] = []
    const n = diffRows.length
    const logicalToVisualStart = new Int32Array(n)
    const logicalToVisualEnd = new Int32Array(n)
    for (let i = 0; i < n; i++) {
        const row = diffRows[i]
        logicalToVisualStart[i] = rows.length
        if (row.kind === 'hunk-header') {
            rows.push({ logicalIndex: i, isContinuation: false, row })
        } else if (!wrap) {
            rows.push({
                logicalIndex: i,
                isContinuation: false,
                row,
                left: row.left,
                right: row.right,
            })
        } else {
            const l = wrapCell(row.left, contentWidth)
            const r = wrapCell(row.right, contentWidth)
            const parts = Math.max(l.length, r.length)
            for (let k = 0; k < parts; k++) {
                rows.push({
                    logicalIndex: i,
                    isContinuation: k > 0,
                    row,
                    left: l[k] ?? BLANK_CELL,
                    right: r[k] ?? BLANK_CELL,
                })
            }
        }
        logicalToVisualEnd[i] = rows.length - 1
    }
    return { rows, logicalToVisualStart, logicalToVisualEnd }
}

export function logicalRangeToVisual(
    result: VisualRowsResult,
    logicalStart: number,
    logicalEnd: number,
): HunkRange | undefined {
    const { logicalToVisualStart, logicalToVisualEnd } = result
    if (logicalStart < 0 || logicalEnd >= logicalToVisualStart.length)
        return undefined
    return {
        start: logicalToVisualStart[logicalStart],
        end: logicalToVisualEnd[logicalEnd],
    }
}

export function computeGutterWidth(diffRows: DiffRow[] | null): number {
    if (!diffRows) return 3
    let max = 1
    for (const row of diffRows) {
        if (row.kind !== 'split') continue
        if (row.left.lineNum !== null && row.left.lineNum > max)
            max = row.left.lineNum
        if (row.right.lineNum !== null && row.right.lineNum > max)
            max = row.right.lineNum
    }
    return max.toString().length
}
