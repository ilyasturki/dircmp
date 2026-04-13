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
    | { kind: 'hunk-header'; content: string }

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
                    type: 'removed',
                    lineNum: r.lineNum,
                    content: r.content,
                },
                right: BLANK_CELL,
            })
            rows.push({
                kind: 'split',
                left: BLANK_CELL,
                right: {
                    type: 'added',
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

export function computeDiffRows(
    leftContent: string,
    rightContent: string,
    leftName: string,
    rightName: string,
): DiffRow[] {
    const patch = structuredPatch(
        leftName,
        rightName,
        leftContent,
        rightContent,
        undefined,
        undefined,
        { context: 3 },
    )

    const rows: DiffRow[] = []
    for (const hunk of patch.hunks) {
        rows.push({
            kind: 'hunk-header',
            content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        })

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
