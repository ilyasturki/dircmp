import type { Dispatch } from 'react'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { structuredPatch } from 'diff'
import { Box, Text, useInput } from 'ink'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Shortcut } from '~/keymap'
import type { Action, CompareEntry } from '~/utils/types'
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
}

interface DiffLine {
    type: 'context' | 'added' | 'removed' | 'hunk-header'
    leftLineNum: number | null
    rightLineNum: number | null
    content: string
}

const MAX_DIFF_SIZE = 1_000_000

function computeDiffLines(
    leftContent: string,
    rightContent: string,
    leftName: string,
    rightName: string,
): DiffLine[] {
    const patch = structuredPatch(
        leftName,
        rightName,
        leftContent,
        rightContent,
        undefined,
        undefined,
        { context: 3 },
    )

    const lines: DiffLine[] = []
    for (const hunk of patch.hunks) {
        lines.push({
            type: 'hunk-header',
            leftLineNum: null,
            rightLineNum: null,
            content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        })

        let leftNum = hunk.oldStart
        let rightNum = hunk.newStart
        for (const line of hunk.lines) {
            const prefix = line[0]
            const content = line.slice(1)
            if (prefix === '-') {
                lines.push({
                    type: 'removed',
                    leftLineNum: leftNum++,
                    rightLineNum: null,
                    content,
                })
            } else if (prefix === '+') {
                lines.push({
                    type: 'added',
                    leftLineNum: null,
                    rightLineNum: rightNum++,
                    content,
                })
            } else {
                lines.push({
                    type: 'context',
                    leftLineNum: leftNum++,
                    rightLineNum: rightNum++,
                    content,
                })
            }
        }
    }
    return lines
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
}: FileDiffProps) {
    const [lines, setLines] = useState<DiffLine[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [focusedHunk, setFocusedHunk] = useState(0)
    const [scrollOffset, setScrollOffset] = useState(0)
    const pendingGRef = useRef(false)

    // header (1) + footer (1) + optional hints (1) reserved rows
    const contentHeight = Math.max(1, rows - 2 - (showHints ? 1 : 0))

    const hunkRanges = useMemo(() => {
        if (!lines || lines.length === 0) return []
        const ranges: Array<{ start: number; end: number }> = []
        let blockStart = -1
        for (let i = 0; i < lines.length; i++) {
            const isChange =
                lines[i].type === 'added' || lines[i].type === 'removed'
            if (isChange) {
                if (blockStart === -1) blockStart = i
            } else if (blockStart !== -1) {
                ranges.push({ start: blockStart, end: i - 1 })
                blockStart = -1
            }
        }
        if (blockStart !== -1) {
            ranges.push({ start: blockStart, end: lines.length - 1 })
        }
        return ranges
    }, [lines])

    useEffect(() => {
        const range = hunkRanges[focusedHunk]
        if (!range) return
        const total = lines?.length ?? 0
        const maxScroll = Math.max(0, total - contentHeight)
        setScrollOffset((prev) => {
            if (range.start < prev) return range.start
            if (range.end >= prev + contentHeight) {
                return Math.min(range.start, maxScroll)
            }
            return prev
        })
    }, [focusedHunk, hunkRanges, contentHeight, lines])

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

                const diffLines = computeDiffLines(
                    leftContent,
                    rightContent,
                    entry.relativePath,
                    entry.relativePath,
                )

                if (!cancelled) {
                    if (diffLines.length === 0) {
                        setError('Files are identical')
                    } else {
                        setLines(diffLines)
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
            if (!lines || hunkRanges.length === 0) return
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

    const visibleLines = lines?.slice(
        scrollOffset,
        scrollOffset + contentHeight,
    )

    // Compute gutter width from max line number
    const gutterWidth =
        lines ?
            Math.max(
                ...lines.map((l) => l.leftLineNum ?? 0),
                ...lines.map((l) => l.rightLineNum ?? 0),
            ).toString().length
        :   3
    // left gutter + separator + right gutter + separator + prefix + space
    const gutterTotal = gutterWidth + 1 + gutterWidth + 1 + 1 + 1

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
            : !lines ?
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
                    {visibleLines!.map((line, i) => {
                        const idx = scrollOffset + i
                        const focusedRange = hunkRanges[focusedHunk]
                        const isFocused =
                            focusedRange !== undefined
                            && idx >= focusedRange.start
                            && idx <= focusedRange.end
                        const leftGutter =
                            line.leftLineNum !== null ?
                                String(line.leftLineNum).padStart(gutterWidth)
                            :   ' '.repeat(gutterWidth)
                        const rightGutter =
                            line.rightLineNum !== null ?
                                String(line.rightLineNum).padStart(gutterWidth)
                            :   ' '.repeat(gutterWidth)

                        let prefix: string
                        let color: string | undefined
                        if (line.type === 'added') {
                            prefix = '+'
                            color = 'green'
                        } else if (line.type === 'removed') {
                            prefix = '-'
                            color = 'red'
                        } else if (line.type === 'hunk-header') {
                            prefix = ' '
                            color = 'cyan'
                        } else {
                            prefix = ' '
                            color = undefined
                        }

                        const maxContentWidth = Math.max(
                            0,
                            columns - gutterTotal,
                        )
                        const displayContent = line.content
                            .slice(0, maxContentWidth)
                            .padEnd(maxContentWidth)

                        const bg = isFocused ? 'blackBright' : undefined

                        return (
                            <Text
                                key={idx}
                                color={color}
                                dimColor={line.type === 'hunk-header'}
                                backgroundColor={bg}
                            >
                                <Text
                                    dimColor={!isFocused}
                                    backgroundColor={bg}
                                >
                                    {leftGutter}
                                    {'\u2502'}
                                    {rightGutter}
                                </Text>{' '}
                                {prefix} {displayContent}
                            </Text>
                        )
                    })}
                </Box>
            }

            {/* Footer */}
            <Box>
                <Text dimColor>
                    {lines && hunkRanges.length > 0 ?
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
