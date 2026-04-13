import type { Dispatch } from 'react'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { diffWordsWithSpace, structuredPatch } from 'diff'
import { Box, Text, useInput } from 'ink'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Shortcut } from '~/keymap'
import type { Action, CompareEntry, PanelSide } from '~/utils/types'
import { KeyboardHints } from '~/components/keyboard-hints'
import { useUniversalShortcuts } from '~/hooks'
import { isBinary } from '~/utils/binary'

interface FileDiffProps {
    entry: CompareEntry
    leftDir: string
    rightDir: string
    leftFilePath?: string
    rightFilePath?: string
    dispatch: Dispatch<Action>
    columns: number
    rows: number
    keymap?: Shortcut[]
    dialogOpen?: boolean
    showHints?: boolean
    focusedSide?: PanelSide
}

type CellType = 'context' | 'added' | 'removed' | 'blank' | 'changed'

interface Segment {
    text: string
    changed: boolean
}

interface DiffCell {
    type: CellType
    lineNum: number | null
    content: string
    segments?: Segment[]
}

type DiffRow =
    | { kind: 'split'; left: DiffCell; right: DiffCell }
    | { kind: 'hunk-header'; content: string }

interface HunkRange {
    start: number
    end: number
}

const MAX_DIFF_SIZE = 1_000_000
const PAIR_SIMILARITY_THRESHOLD = 0.4
const BLANK_CELL: DiffCell = { type: 'blank', lineNum: null, content: '' }

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

function computeDiffRows(
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

function computeHunkRanges(diffRows: DiffRow[] | null): HunkRange[] {
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

function colorFor(type: CellType): string | undefined {
    if (type === 'added' || type === 'removed' || type === 'changed')
        return 'yellow'
    return undefined
}

async function readFileForDiff(
    filePath: string,
): Promise<{ content: string } | { error: string }> {
    const buf = await fsp.readFile(filePath)
    if (buf.length > MAX_DIFF_SIZE) {
        return { error: 'File too large to diff inline' }
    }
    if (isBinary(buf)) {
        return { error: 'Binary file — cannot display diff' }
    }
    return { content: buf.toString('utf-8') }
}

function useDiffRows(
    entry: CompareEntry,
    leftPath: string,
    rightPath: string,
): { diffRows: DiffRow[] | null; error: string | null } {
    const [diffRows, setDiffRows] = useState<DiffRow[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                let leftContent = ''
                let rightContent = ''

                if (entry.status !== 'only-right') {
                    const result = await readFileForDiff(leftPath)
                    if (cancelled) return
                    if ('error' in result) {
                        setError(result.error)
                        return
                    }
                    leftContent = result.content
                }

                if (entry.status !== 'only-left') {
                    const result = await readFileForDiff(rightPath)
                    if (cancelled) return
                    if ('error' in result) {
                        setError(result.error)
                        return
                    }
                    rightContent = result.content
                }

                const computed = computeDiffRows(
                    leftContent,
                    rightContent,
                    entry.relativePath,
                    entry.relativePath,
                )

                if (cancelled) return
                if (computed.length === 0) {
                    setError('Files are identical')
                } else {
                    setDiffRows(computed)
                }
            } catch (e) {
                if (!cancelled) {
                    setError(
                        e instanceof Error ? e.message : 'Failed to read file',
                    )
                }
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [entry, leftPath, rightPath])

    return { diffRows, error }
}

function useHunkNavigation(hunkRanges: HunkRange[], isActive: boolean): number {
    const [focusedHunk, setFocusedHunk] = useState(0)
    const pendingGRef = useRef(false)

    useInput(
        (input, key) => {
            if (hunkRanges.length === 0) return
            if (input === 'j' || key.downArrow) {
                setFocusedHunk((prev) =>
                    Math.min(hunkRanges.length - 1, prev + 1),
                )
                pendingGRef.current = false
            } else if (input === 'k' || key.upArrow) {
                setFocusedHunk((prev) => Math.max(0, prev - 1))
                pendingGRef.current = false
            } else if (input === 'G') {
                setFocusedHunk(hunkRanges.length - 1)
                pendingGRef.current = false
            } else if (input === 'g') {
                if (pendingGRef.current) {
                    setFocusedHunk(0)
                    pendingGRef.current = false
                } else {
                    pendingGRef.current = true
                }
            } else {
                pendingGRef.current = false
            }
        },
        { isActive },
    )

    return focusedHunk
}

function useAutoScroll(
    focusedRange: HunkRange | undefined,
    totalRows: number,
    contentHeight: number,
): number {
    const [scrollOffset, setScrollOffset] = useState(0)
    useEffect(() => {
        if (!focusedRange) return
        const maxScroll = Math.max(0, totalRows - contentHeight)
        setScrollOffset((prev) => {
            if (focusedRange.start < prev) return focusedRange.start
            if (focusedRange.end >= prev + contentHeight) {
                return Math.min(focusedRange.start, maxScroll)
            }
            return prev
        })
    }, [focusedRange, totalRows, contentHeight])
    return scrollOffset
}

function computeGutterWidth(diffRows: DiffRow[] | null): number {
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

export function FileDiff({
    entry,
    leftDir,
    rightDir,
    leftFilePath,
    rightFilePath,
    dispatch,
    columns,
    rows,
    keymap,
    dialogOpen,
    showHints,
    focusedSide = 'left',
}: FileDiffProps) {
    const leftPath = leftFilePath ?? path.join(leftDir, entry.relativePath)
    const rightPath = rightFilePath ?? path.join(rightDir, entry.relativePath)

    const { diffRows, error } = useDiffRows(entry, leftPath, rightPath)
    const hunkRanges = useMemo(() => computeHunkRanges(diffRows), [diffRows])

    const isActive = !(dialogOpen ?? false)
    useUniversalShortcuts(keymap ?? [], dispatch, isActive, 'fileDiff')
    const focusedHunk = useHunkNavigation(hunkRanges, isActive)

    // header (1) + footer (1) + optional hints (1) reserved rows
    const contentHeight = Math.max(1, rows - 2 - (showHints ? 1 : 0))
    const scrollOffset = useAutoScroll(
        hunkRanges[focusedHunk],
        diffRows?.length ?? 0,
        contentHeight,
    )

    const hintItems = (keymap ?? [])
        .filter(
            (s) =>
                (s.mode === 'universal' || s.mode === 'fileDiff')
                && s.keyLabel !== '',
        )
        .map((s) => ({ key: s.keyLabel, label: s.description }))

    const gutterWidth = computeGutterWidth(diffRows)
    // Per half: gutter + '│' + ' ' + content = gutter + 2 + content
    // Plus a middle ' │ ' separator (3 chars) between halves.
    const halfOverhead = gutterWidth + 2
    const contentWidth = Math.max(
        0,
        Math.floor((columns - 3 - 2 * halfOverhead) / 2),
    )

    const visibleRows = diffRows?.slice(
        scrollOffset,
        scrollOffset + contentHeight,
    )

    function renderCell(
        cell: DiffCell,
        inFocusedBlock: boolean,
        isFocusedSide: boolean,
    ): React.ReactNode {
        const gutter =
            cell.lineNum !== null ?
                String(cell.lineNum).padStart(gutterWidth)
            :   ' '.repeat(gutterWidth)
        const isSelected = inFocusedBlock && isFocusedSide
        const bg = inFocusedBlock && !isFocusedSide ? 'white' : undefined

        let body: React.ReactNode
        if (cell.segments) {
            const nodes: React.ReactNode[] = []
            let remaining = contentWidth
            let key = 0
            for (const seg of cell.segments) {
                if (remaining <= 0) break
                const text = seg.text.slice(0, remaining)
                remaining -= text.length
                if (seg.changed) {
                    nodes.push(
                        <Text
                            key={key++}
                            color='yellow'
                            backgroundColor='red'
                            inverse={false}
                        >
                            {text}
                        </Text>,
                    )
                } else {
                    nodes.push(
                        <Text
                            key={key++}
                            backgroundColor={bg}
                            inverse={isSelected}
                        >
                            {text}
                        </Text>,
                    )
                }
            }
            if (remaining > 0) {
                nodes.push(
                    <Text
                        key={key++}
                        backgroundColor={bg}
                        inverse={isSelected}
                    >
                        {' '.repeat(remaining)}
                    </Text>,
                )
            }
            body = nodes
        } else {
            body = cell.content.slice(0, contentWidth).padEnd(contentWidth)
        }

        return (
            <Text
                color={colorFor(cell.type)}
                backgroundColor={bg}
                inverse={isSelected}
            >
                <Text
                    color={isFocusedSide ? 'cyan' : undefined}
                    dimColor={!isFocusedSide}
                    backgroundColor={bg}
                    inverse={isSelected}
                >
                    {gutter}
                    {'\u2502'}
                </Text>{' '}
                {body}
            </Text>
        )
    }

    return (
        <Box
            position='absolute'
            width={columns}
            height={rows}
            flexDirection='column'
        >
            {/* Blank backdrop */}
            <Box
                position='absolute'
                flexDirection='column'
            >
                {Array.from({ length: rows }, (_, i) => (
                    <Text key={i}>{' '.repeat(columns)}</Text>
                ))}
            </Box>

            {/* Header */}
            <Box>
                <Text
                    bold
                    color='cyan'
                >
                    {' '}
                    {entry.relativePath}{' '}
                </Text>
            </Box>

            {/* Content */}
            {error ?
                <Box
                    flexGrow={1}
                    justifyContent='center'
                    alignItems='center'
                >
                    <Text color='yellow'>{error}</Text>
                </Box>
            : !diffRows ?
                <Box
                    flexGrow={1}
                    justifyContent='center'
                    alignItems='center'
                >
                    <Text color='yellow'>Loading...</Text>
                </Box>
            :   <Box
                    flexDirection='column'
                    flexGrow={1}
                >
                    {visibleRows!.map((row, i) => {
                        const idx = scrollOffset + i
                        const focusedRange = hunkRanges[focusedHunk]
                        const isFocused =
                            focusedRange !== undefined
                            && idx >= focusedRange.start
                            && idx <= focusedRange.end

                        if (row.kind === 'hunk-header') {
                            const totalWidth =
                                2 * (halfOverhead + contentWidth) + 3
                            const text = row.content
                                .slice(0, totalWidth)
                                .padEnd(totalWidth)
                            return (
                                <Text
                                    key={idx}
                                    color='cyan'
                                    dimColor
                                >
                                    {text}
                                </Text>
                            )
                        }

                        return (
                            <Box key={idx}>
                                {renderCell(
                                    row.left,
                                    isFocused,
                                    focusedSide === 'left',
                                )}
                                <Text dimColor={!isFocused}>{' \u2502 '}</Text>
                                {renderCell(
                                    row.right,
                                    isFocused,
                                    focusedSide === 'right',
                                )}
                            </Box>
                        )
                    })}
                </Box>
            }

            {/* Footer */}
            <Box>
                <Text dimColor>
                    {diffRows && hunkRanges.length > 0 ?
                        ` hunk ${focusedHunk + 1} of ${hunkRanges.length}`
                    :   ''}
                </Text>
            </Box>

            {/* Keyboard hints */}
            {showHints && (
                <Box>
                    <KeyboardHints
                        items={hintItems}
                        columns={columns}
                    />
                </Box>
            )}
        </Box>
    )
}
