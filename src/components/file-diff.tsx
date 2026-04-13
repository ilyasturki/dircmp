import type { Dispatch } from 'react'
import path from 'node:path'
import { Box, Text } from 'ink'
import { useCallback, useMemo } from 'react'

import type { Shortcut } from '~/keymap'
import type { Action, CompareEntry, PanelSide } from '~/utils/types'
import { KeyboardHints } from '~/components/keyboard-hints'
import { useUniversalShortcuts } from '~/hooks'
import { DiffCell } from './file-diff/diff-cell'
import {
    applyHunkToContent,
    computeGutterWidth,
    computeHunkRanges,
} from './file-diff/diff-compute'
import {
    useAutoScroll,
    useDiffRows,
    useHunkNavigation,
} from './file-diff/hooks'

interface FileDiffProps {
    entry: CompareEntry
    leftDir: string
    rightDir: string
    leftFilePath?: string
    rightFilePath?: string
    dispatch: Dispatch<Action>
    onExecuteAction?: (action: Action) => void
    columns: number
    rows: number
    keymap?: Shortcut[]
    dialogOpen?: boolean
    showHints?: boolean
    focusedSide?: PanelSide
}

export function FileDiff({
    entry,
    leftDir,
    rightDir,
    leftFilePath,
    rightFilePath,
    dispatch,
    onExecuteAction,
    columns,
    rows,
    keymap,
    dialogOpen,
    showHints,
    focusedSide = 'left',
}: FileDiffProps) {
    const leftPath = leftFilePath ?? path.join(leftDir, entry.relativePath)
    const rightPath = rightFilePath ?? path.join(rightDir, entry.relativePath)

    const { diffRows, error, leftContent, rightContent } = useDiffRows(
        entry,
        leftPath,
        rightPath,
    )
    const hunkRanges = useMemo(() => computeHunkRanges(diffRows), [diffRows])

    const isActive = !(dialogOpen ?? false)
    const focusedHunk = useHunkNavigation(hunkRanges, isActive)

    const handleDispatch = useCallback(
        (action: Action) => {
            if (
                action.type === 'COPY_HUNK_TO_LEFT'
                || action.type === 'COPY_HUNK_TO_RIGHT'
                || action.type === 'COPY_HUNK_FROM_FOCUSED'
            ) {
                if (!diffRows || !onExecuteAction) return
                const range = hunkRanges[focusedHunk]
                if (!range) return
                const toRight =
                    action.type === 'COPY_HUNK_TO_RIGHT'
                    || (action.type === 'COPY_HUNK_FROM_FOCUSED'
                        && focusedSide === 'left')
                const destSide: PanelSide = toRight ? 'right' : 'left'
                const destAbsPath = toRight ? rightPath : leftPath
                const targetContent = toRight ? rightContent : leftContent
                const newContent = applyHunkToContent(
                    diffRows,
                    range,
                    targetContent,
                    toRight ? 'toRight' : 'toLeft',
                )
                onExecuteAction({
                    type: 'APPLY_HUNK',
                    destAbsPath,
                    destSide,
                    newContent,
                })
                return
            }
            dispatch(action)
        },
        [
            dispatch,
            onExecuteAction,
            diffRows,
            hunkRanges,
            focusedHunk,
            leftPath,
            rightPath,
            leftContent,
            rightContent,
            focusedSide,
        ],
    )

    useUniversalShortcuts(keymap ?? [], handleDispatch, isActive, 'fileDiff')

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
                                <DiffCell
                                    cell={row.left}
                                    inFocusedBlock={isFocused}
                                    isFocusedSide={focusedSide === 'left'}
                                    gutterWidth={gutterWidth}
                                    contentWidth={contentWidth}
                                />
                                <Text dimColor={!isFocused}>{' \u2502 '}</Text>
                                <DiffCell
                                    cell={row.right}
                                    inFocusedBlock={isFocused}
                                    isFocusedSide={focusedSide === 'right'}
                                    gutterWidth={gutterWidth}
                                    contentWidth={contentWidth}
                                />
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
