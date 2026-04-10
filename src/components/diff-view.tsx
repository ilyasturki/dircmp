import type { Dispatch } from 'react'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { structuredPatch } from 'diff'
import { Box, Text, useInput } from 'ink'
import { useEffect, useState } from 'react'

import type { Action, CompareEntry } from '~/utils/types'
import { useScrollNavigation } from '~/hooks'
import { isBinary } from '~/utils/binary'

interface DiffViewProps {
    entry: CompareEntry
    leftDir: string
    rightDir: string
    leftFilePath?: string
    rightFilePath?: string
    dispatch: Dispatch<Action>
    columns: number
    rows: number
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

export function DiffView({
    entry,
    leftDir,
    rightDir,
    leftFilePath,
    rightFilePath,
    dispatch,
    columns,
    rows,
}: DiffViewProps) {
    const [lines, setLines] = useState<DiffLine[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    // header (1) + footer (1) = 2 reserved rows
    const contentHeight = Math.max(1, rows - 2)

    const { scrollOffset, handleInput: handleNav } = useScrollNavigation({
        totalLines: lines?.length ?? 0,
        maxVisibleLines: contentHeight,
        useDoubleG: false,
    })

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

    useInput((input, key) => {
        if (key.escape || input === 'q') {
            dispatch({ type: 'HIDE_DIFF_VIEW' })
            return
        }

        if (!lines) return

        handleNav(input, key)
    })

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
                <Text dimColor> q/Esc to close</Text>
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
                        const displayContent = line.content.slice(
                            0,
                            maxContentWidth,
                        )

                        return (
                            <Text
                                key={idx}
                                color={color}
                                dimColor={line.type === 'hunk-header'}
                            >
                                <Text dimColor>
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
                    {lines ?
                        ` ${scrollOffset + 1}-${Math.min(scrollOffset + contentHeight, lines.length)} of ${lines.length} lines`
                    :   ''}
                </Text>
            </Box>
        </Box>
    )
}
