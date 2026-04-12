import type { Dispatch } from 'react'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { structuredPatch } from 'diff'
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

type CellType = 'context' | 'added' | 'removed' | 'blank'

interface DiffCell {
    type: CellType
    lineNum: number | null
    content: string
}

type DiffRow =
    | { kind: 'split'; left: DiffCell; right: DiffCell }
    | { kind: 'hunk-header'; content: string }

const MAX_DIFF_SIZE = 1_000_000
const BLANK_CELL: DiffCell = { type: 'blank', lineNum: null, content: '' }

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
        for (const line of hunk.lines) {
            const prefix = line[0]
            const content = line.slice(1)
            if (prefix === '-') {
                rows.push({
                    kind: 'split',
                    left: {
                        type: 'removed',
                        lineNum: leftNum++,
                        content,
                    },
                    right: BLANK_CELL,
                })
            } else if (prefix === '+') {
                rows.push({
                    kind: 'split',
                    left: BLANK_CELL,
                    right: {
                        type: 'added',
                        lineNum: rightNum++,
                        content,
                    },
                })
            } else {
                rows.push({
                    kind: 'split',
                    left: {
                        type: 'context',
                        lineNum: leftNum++,
                        content,
                    },
                    right: {
                        type: 'context',
                        lineNum: rightNum++,
                        content,
                    },
                })
            }
        }
    }
    return rows
}

function isChangeRow(row: DiffRow): boolean {
    if (row.kind !== 'split') return false
    return (
        row.left.type === 'added'
        || row.left.type === 'removed'
        || row.right.type === 'added'
        || row.right.type === 'removed'
    )
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
    const [diffRows, setDiffRows] = useState<DiffRow[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [focusedHunk, setFocusedHunk] = useState(0)
    const [scrollOffset, setScrollOffset] = useState(0)
    const pendingGRef = useRef(false)

    // header (1) + footer (1) + optional hints (1) reserved rows
    const contentHeight = Math.max(1, rows - 2 - (showHints ? 1 : 0))

    const hunkRanges = useMemo(() => {
        if (!diffRows || diffRows.length === 0) return []
        const ranges: Array<{ start: number; end: number }> = []
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
    }, [diffRows])

    useEffect(() => {
        const range = hunkRanges[focusedHunk]
        if (!range) return
        const total = diffRows?.length ?? 0
        const maxScroll = Math.max(0, total - contentHeight)
        setScrollOffset((prev) => {
            if (range.start < prev) return range.start
            if (range.end >= prev + contentHeight) {
                return Math.min(range.start, maxScroll)
            }
            return prev
        })
    }, [focusedHunk, hunkRanges, contentHeight, diffRows])

    const isActive = !(dialogOpen ?? false)

    useUniversalShortcuts(keymap ?? [], dispatch, isActive, 'fileDiff')

    const hintItems = (keymap ?? [])
        .filter(
            (s) =>
                (s.mode === 'universal' || s.mode === 'fileDiff')
                && s.keyLabel !== '',
        )
        .map((s) => ({ key: s.keyLabel, label: s.description }))

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const leftPath =
                    leftFilePath ?? path.join(leftDir, entry.relativePath)
                const rightPath =
                    rightFilePath ?? path.join(rightDir, entry.relativePath)

                let leftContent = ''
                let rightContent = ''

                if (entry.status !== 'only-right') {
                    const buf = await fsp.readFile(leftPath)
                    if (buf.length > MAX_DIFF_SIZE) {
                        if (!cancelled)
                            setError('File too large to diff inline')
                        return
                    }
                    if (isBinary(buf)) {
                        if (!cancelled)
                            setError('Binary file — cannot display diff')
                        return
                    }
                    leftContent = buf.toString('utf-8')
                }

                if (entry.status !== 'only-left') {
                    const buf = await fsp.readFile(rightPath)
                    if (buf.length > MAX_DIFF_SIZE) {
                        if (!cancelled)
                            setError('File too large to diff inline')
                        return
                    }
                    if (isBinary(buf)) {
                        if (!cancelled)
                            setError('Binary file — cannot display diff')
                        return
                    }
                    rightContent = buf.toString('utf-8')
                }

                const rows = computeDiffRows(
                    leftContent,
                    rightContent,
                    entry.relativePath,
                    entry.relativePath,
                )

                if (!cancelled) {
                    if (rows.length === 0) {
                        setError('Files are identical')
                    } else {
                        setDiffRows(rows)
                    }
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
    }, [entry, leftDir, rightDir])

    useInput(
        (input, key) => {
            if (!diffRows || hunkRanges.length === 0) return
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

    const visibleRows = diffRows?.slice(
        scrollOffset,
        scrollOffset + contentHeight,
    )

    // Gutter width: max line number length across both sides.
    const gutterWidth =
        diffRows ?
            Math.max(
                1,
                ...diffRows.flatMap((r) =>
                    r.kind === 'split' ?
                        [r.left.lineNum ?? 0, r.right.lineNum ?? 0]
                    :   [0],
                ),
            ).toString().length
        :   3

    // Per half: gutter + '│' + ' ' + content  = gutter + 2 + content
    // Plus a middle ' │ ' separator (3 chars) between halves.
    const halfOverhead = gutterWidth + 2
    const contentWidth = Math.max(
        0,
        Math.floor((columns - 3 - 2 * halfOverhead) / 2),
    )

    function colorFor(type: CellType): string | undefined {
        if (type === 'added' || type === 'removed') return 'yellow'
        return undefined
    }

    function renderHalf(
        cell: DiffCell,
        inFocusedBlock: boolean,
        isFocusedSide: boolean,
    ): React.ReactNode {
        const gutter =
            cell.lineNum !== null ?
                String(cell.lineNum).padStart(gutterWidth)
            :   ' '.repeat(gutterWidth)
        const content = cell.content.slice(0, contentWidth).padEnd(contentWidth)
        const color = colorFor(cell.type)
        const isSelected = inFocusedBlock && isFocusedSide
        const isDimSelected = inFocusedBlock && !isFocusedSide
        const bg = isDimSelected ? 'white' : undefined
        return (
            <Text
                color={color}
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
                {content}
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
                                {renderHalf(
                                    row.left,
                                    isFocused,
                                    focusedSide === 'left',
                                )}
                                <Text dimColor={!isFocused}>{' \u2502 '}</Text>
                                {renderHalf(
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
