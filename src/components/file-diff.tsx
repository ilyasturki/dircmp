import type { Dispatch } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { Box, Text, useInput } from 'ink'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Shortcut } from '~/keymap'
import type {
    Action,
    CompareEntry,
    HunkUndoEntry,
    PanelSide,
} from '~/utils/types'
import type { VisualRow, VisualRowsResult } from './file-diff/diff-compute'
import { KeyboardHints } from '~/components/keyboard-hints'
import { PanelBox } from '~/components/panels/panel-box'
import { useUniversalShortcuts } from '~/hooks'
import { statFileEntrySync } from '~/utils/scanner'
import { borderFor, theme } from '~/utils/theme'
import { moveToTrash, restoreFromTrash } from '~/utils/trash'
import { DiffCell } from './file-diff/diff-cell'
import {
    applyHunkToContent,
    computeChangeLineIndices,
    computeGutterWidth,
    computeHunkRanges,
    DEFAULT_DIFF_CONTEXT,
    expandToVisualRows,
    logicalRangeToVisual,
} from './file-diff/diff-compute'
import {
    useAutoScroll,
    useDiffRows,
    useHunkNavigation,
    useLineNavigation,
    useViewportShortcuts,
} from './file-diff/hooks'

interface FileDiffProps {
    entry: CompareEntry
    leftDir: string
    rightDir: string
    leftFilePath?: string
    rightFilePath?: string
    leftRelativePath?: string
    rightRelativePath?: string
    dispatch: Dispatch<Action>
    onToast?: (message: string) => void
    onShellOut?: (command: string, args: string[]) => void
    columns: number
    rows: number
    keymap?: Shortcut[]
    dialogOpen?: boolean
    showHints?: boolean
    focusedSide?: PanelSide
    compareContents?: boolean
    followSymlinks?: boolean
}

const EMPTY_VISUAL_RESULT: VisualRowsResult = {
    rows: [],
    logicalToVisualStart: new Int32Array(0),
    logicalToVisualEnd: new Int32Array(0),
}

function truncatePathLeft(p: string, maxWidth: number): string {
    if (maxWidth <= 0) return ''
    if (p.length <= maxWidth) return p
    if (maxWidth === 1) return '…'
    return '…' + p.slice(p.length - (maxWidth - 1))
}

function writeFileWithBackup(
    destAbsPath: string,
    newContent: string,
): string | null {
    let backupTrashPath: string | null = null
    if (fs.existsSync(destAbsPath)) {
        backupTrashPath = moveToTrash(destAbsPath)
    }
    fs.mkdirSync(path.dirname(destAbsPath), { recursive: true })
    fs.writeFileSync(destAbsPath, newContent)
    return backupTrashPath
}

export function FileDiff({
    entry,
    leftDir,
    rightDir,
    leftFilePath,
    rightFilePath,
    leftRelativePath,
    rightRelativePath,
    dispatch,
    onToast,
    onShellOut,
    columns,
    rows,
    keymap,
    dialogOpen,
    showHints,
    focusedSide = 'left',
    compareContents = true,
    followSymlinks = false,
}: FileDiffProps) {
    const leftPath = leftFilePath ?? path.join(leftDir, entry.relativePath)
    const rightPath = rightFilePath ?? path.join(rightDir, entry.relativePath)
    // Relative paths used to patch the scan maps back on close. Default to
    // entry.relativePath only when the caller didn't override the file path
    // (matched-entry mode). When paths are overridden without explicit
    // relatives (standalone file-diff app) both stay undefined and no patch
    // is dispatched.
    const leftRel =
        leftRelativePath
        ?? (leftFilePath === undefined ? entry.relativePath : undefined)
    const rightRel =
        rightRelativePath
        ?? (rightFilePath === undefined ? entry.relativePath : undefined)

    const [reloadKey, setReloadKey] = useState(0)
    const [undoStack, setUndoStack] = useState<HunkUndoEntry[]>([])
    const [redoStack, setRedoStack] = useState<HunkUndoEntry[]>([])
    const [contextSize, setContextSize] = useState(DEFAULT_DIFF_CONTEXT)
    const [isLineMode, setIsLineMode] = useState(false)
    const [wrapMode, setWrapMode] = useState(false)

    const { diffRows, error, leftContent, rightContent } = useDiffRows(
        entry,
        leftPath,
        rightPath,
        reloadKey,
        contextSize,
    )
    const hunkRanges = useMemo(() => computeHunkRanges(diffRows), [diffRows])
    const changeLineIndices = useMemo(
        () => computeChangeLineIndices(diffRows),
        [diffRows],
    )

    const isActive = !(dialogOpen ?? false)
    const focusedHunk = useHunkNavigation(hunkRanges, isActive && !isLineMode)
    const { lineCursor, setLineCursor } = useLineNavigation(
        changeLineIndices,
        isActive && isLineMode,
    )

    // Exit line mode if no change lines remain after a successful reload.
    // Skip when diffRows is null (still loading) so copy actions don't exit.
    useEffect(() => {
        if (isLineMode && diffRows !== null && changeLineIndices.length === 0) {
            setIsLineMode(false)
        }
    }, [isLineMode, diffRows, changeLineIndices])

    // Clamp cursor within bounds when indices change.
    useEffect(() => {
        if (changeLineIndices.length === 0) return
        setLineCursor((prev) =>
            Math.min(Math.max(0, prev), changeLineIndices.length - 1),
        )
    }, [changeLineIndices, setLineCursor])

    const focusedRowIndex = changeLineIndices[lineCursor]
    const focusedRange = useMemo(
        () =>
            isLineMode && focusedRowIndex !== undefined ?
                { start: focusedRowIndex, end: focusedRowIndex }
            :   hunkRanges[focusedHunk],
        [isLineMode, focusedRowIndex, hunkRanges, focusedHunk],
    )

    // Esc exits line mode (must run before universal shortcut closes diff).
    useInput(
        (_input, key) => {
            if (key.escape) setIsLineMode(false)
        },
        { isActive: isActive && isLineMode },
    )

    const handleDispatch = useCallback(
        (action: Action) => {
            if (action.type === 'TOGGLE_DIFF_WRAP') {
                setWrapMode((w) => !w)
                return
            }
            if (action.type === 'TOGGLE_LINE_MODE') {
                if (isLineMode) {
                    setIsLineMode(false)
                    return
                }
                if (changeLineIndices.length === 0) return
                const hunkStart = hunkRanges[focusedHunk]?.start ?? 0
                const initial = changeLineIndices.findIndex(
                    (i) => i >= hunkStart,
                )
                setLineCursor(initial === -1 ? 0 : initial)
                setIsLineMode(true)
                return
            }
            if (
                action.type === 'COPY_HUNK_TO_LEFT'
                || action.type === 'COPY_HUNK_TO_RIGHT'
                || action.type === 'COPY_HUNK_FROM_FOCUSED'
            ) {
                if (!diffRows) return
                const range = focusedRange
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
                const backupTrashPath = writeFileWithBackup(
                    destAbsPath,
                    newContent,
                )
                setUndoStack((prev) => [
                    ...prev,
                    { destAbsPath, destSide, backupTrashPath, newContent },
                ])
                setRedoStack([])
                setReloadKey((k) => k + 1)
                return
            }
            if (action.type === 'UNDO') {
                const top = undoStack[undoStack.length - 1]
                if (!top) {
                    onToast?.('Nothing to undo')
                    return
                }
                fs.rmSync(top.destAbsPath, { force: true })
                if (top.backupTrashPath) {
                    restoreFromTrash(top.backupTrashPath, top.destAbsPath)
                }
                setUndoStack((prev) => prev.slice(0, -1))
                setRedoStack((prev) => [...prev, top])
                setReloadKey((k) => k + 1)
                return
            }
            if (action.type === 'REFRESH') {
                setReloadKey((k) => k + 1)
                return
            }
            if (action.type === 'OPEN_IN_EDITOR') {
                if (!onShellOut) return
                const editor = process.env.EDITOR || process.env.VISUAL
                if (!editor) return
                const targetPath = focusedSide === 'left' ? leftPath : rightPath
                const parts = editor.split(/\s+/)
                onShellOut(parts[0]!, [...parts.slice(1), targetPath])
                return
            }
            if (action.type === 'INCREASE_DIFF_CONTEXT') {
                setContextSize((c) => c + 1)
                return
            }
            if (action.type === 'DECREASE_DIFF_CONTEXT') {
                setContextSize((c) => Math.max(0, c - 1))
                return
            }
            if (action.type === 'REDO') {
                const top = redoStack[redoStack.length - 1]
                if (!top) {
                    onToast?.('Nothing to redo')
                    return
                }
                const backupTrashPath = writeFileWithBackup(
                    top.destAbsPath,
                    top.newContent,
                )
                setRedoStack((prev) => prev.slice(0, -1))
                setUndoStack((prev) => [...prev, { ...top, backupTrashPath }])
                setReloadKey((k) => k + 1)
                return
            }
            if (
                action.type === 'HIDE_FILE_DIFF'
                && leftRel !== undefined
                && rightRel !== undefined
            ) {
                const editedSides = new Set<PanelSide>()
                for (const e of undoStack) editedSides.add(e.destSide)
                for (const e of redoStack) editedSides.add(e.destSide)
                if (editedSides.size > 0) {
                    dispatch({
                        type: 'PATCH_FILE_ENTRY',
                        left:
                            editedSides.has('left') ?
                                {
                                    relativePath: leftRel,
                                    entry: statFileEntrySync(
                                        leftDir,
                                        leftRel,
                                        compareContents,
                                        followSymlinks,
                                    ),
                                }
                            :   undefined,
                        right:
                            editedSides.has('right') ?
                                {
                                    relativePath: rightRel,
                                    entry: statFileEntrySync(
                                        rightDir,
                                        rightRel,
                                        compareContents,
                                        followSymlinks,
                                    ),
                                }
                            :   undefined,
                    })
                }
            }
            dispatch(action)
        },
        [
            dispatch,
            diffRows,
            focusedRange,
            isLineMode,
            changeLineIndices,
            hunkRanges,
            focusedHunk,
            setLineCursor,
            leftPath,
            rightPath,
            leftContent,
            rightContent,
            focusedSide,
            undoStack,
            redoStack,
            onToast,
            onShellOut,
            leftDir,
            rightDir,
            leftRel,
            rightRel,
            compareContents,
            followSymlinks,
        ],
    )

    // In line mode, narrow closeFileDiff to `q` only so Esc can exit line mode.
    const activeKeymap = useMemo(
        () =>
            isLineMode ?
                (keymap ?? []).map((s) =>
                    s.id === 'closeFileDiff' ?
                        { ...s, match: (input: string) => input === 'q' }
                    :   s,
                )
            :   (keymap ?? []),
        [keymap, isLineMode],
    )

    useUniversalShortcuts(activeKeymap, handleDispatch, isActive, 'fileDiff')

    // panel top title (1) + panel bottom border (1) + footer (1) + optional hints (1)
    const contentHeight = Math.max(1, rows - 3 - (showHints ? 1 : 0))

    const EXCLUDED_HINTS = new Set(['closeFileDiff', 'releaseNotes'])
    const NEAR_END_HINTS = new Set(['openInEditor', 'refresh', 'preferences'])
    const END_HINTS = new Set([
        'fileDiffIncreaseContext',
        'fileDiffDecreaseContext',
        'fileDiffToggleWrap',
    ])
    const relevantShortcuts = (keymap ?? []).filter(
        (s) =>
            (s.mode === 'universal' || s.mode === 'fileDiff')
            && s.keyLabel !== ''
            && !EXCLUDED_HINTS.has(s.id),
    )
    const hintItems = [
        ...relevantShortcuts.filter(
            (s) => !NEAR_END_HINTS.has(s.id) && !END_HINTS.has(s.id),
        ),
        ...relevantShortcuts.filter((s) => NEAR_END_HINTS.has(s.id)),
        ...relevantShortcuts.filter((s) => END_HINTS.has(s.id)),
    ].map((s) => ({ key: s.keyLabel, label: s.description }))

    const keyFor = (id: string) =>
        (keymap ?? []).find((s) => s.id === id)?.helpKey ?? ''
    const wrapKey = keyFor('fileDiffToggleWrap')
    const increaseContextKey = keyFor('fileDiffIncreaseContext')
    const decreaseContextKey = keyFor('fileDiffDecreaseContext')
    const contextKeyHint = [increaseContextKey, decreaseContextKey]
        .filter((k) => k !== '')
        .join('/')

    const gutterWidth = computeGutterWidth(diffRows)
    // Per panel inner width = panelWidth - 2 bold borders.
    // Use floor(columns/2) - 2 (narrower right panel) so content fits both sides.
    // Inner layout per side: gutter + '│' + ' ' + content = gutterWidth + 2 + contentWidth
    const halfOverhead = gutterWidth + 2
    const leftInner = Math.ceil(columns / 2) - 2
    const rightInner = Math.floor(columns / 2) - 2
    const contentWidth = Math.max(0, rightInner - halfOverhead)

    const visualResult = useMemo(
        () =>
            diffRows ?
                expandToVisualRows(diffRows, contentWidth, wrapMode)
            :   EMPTY_VISUAL_RESULT,
        [diffRows, contentWidth, wrapMode],
    )
    const visualRows = visualResult.rows
    const focusedVisualRange = useMemo(
        () =>
            focusedRange ?
                logicalRangeToVisual(
                    visualResult,
                    focusedRange.start,
                    focusedRange.end,
                )
            :   undefined,
        [focusedRange, visualResult],
    )

    const { scrollOffset, setScrollOffset } = useAutoScroll(
        focusedVisualRange,
        visualRows.length,
        contentHeight,
        contextSize,
    )
    useViewportShortcuts(
        focusedVisualRange?.start,
        contentHeight,
        visualRows.length,
        setScrollOffset,
        isActive,
    )

    const visibleVisualRows = visualRows.slice(
        scrollOffset,
        scrollOffset + contentHeight,
    )

    const leftBorderColor = borderFor(focusedSide === 'left')
    const rightBorderColor = borderFor(focusedSide === 'right')

    const backdrop = useMemo(
        () =>
            Array.from({ length: rows }, () => ' '.repeat(columns)).join('\n'),
        [columns, rows],
    )

    return (
        <Box
            position='absolute'
            width={columns}
            height={rows}
            flexDirection='column'
        >
            {/* Blank backdrop */}
            <Box position='absolute'>
                <Text>{backdrop}</Text>
            </Box>

            {/* Content: two PanelBoxes side by side, path as title */}
            {(() => {
                const renderRowHalf = (
                    vRow: VisualRow,
                    visualIdx: number,
                    side: PanelSide,
                ) => {
                    const isFocused =
                        focusedRange !== undefined
                        && vRow.logicalIndex >= focusedRange.start
                        && vRow.logicalIndex <= focusedRange.end

                    if (vRow.row.kind === 'hunk-header') {
                        const label =
                            vRow.row.skipped > 0 ?
                                ` ${vRow.row.skipped} unchanged line${vRow.row.skipped === 1 ? '' : 's'} `
                            :   ''
                        const width = side === 'left' ? leftInner : rightInner
                        const barLen = Math.max(0, width - label.length)
                        const leftBar = '\u2500'.repeat(Math.floor(barLen / 2))
                        const rightBar = '\u2500'.repeat(
                            barLen - Math.floor(barLen / 2),
                        )
                        const text = (leftBar + label + rightBar).slice(
                            0,
                            width,
                        )
                        return (
                            <Text
                                key={visualIdx}
                                color={theme.dimText}
                            >
                                {text}
                            </Text>
                        )
                    }

                    const cell = side === 'left' ? vRow.left! : vRow.right!
                    return (
                        <Box key={visualIdx}>
                            <DiffCell
                                cell={cell}
                                inFocusedBlock={isFocused}
                                isFocusedSide={focusedSide === side}
                                gutterWidth={gutterWidth}
                                contentWidth={contentWidth}
                                showTruncationIndicator={!wrapMode}
                            />
                        </Box>
                    )
                }

                const renderPanelContents = (side: PanelSide) => {
                    if (error) {
                        return (
                            <Box
                                flexGrow={1}
                                justifyContent='center'
                                alignItems='center'
                            >
                                <Text color={theme.warning}>
                                    {side === 'left' ? error : ''}
                                </Text>
                            </Box>
                        )
                    }
                    if (!diffRows) {
                        return (
                            <Box
                                flexGrow={1}
                                justifyContent='center'
                                alignItems='center'
                            >
                                <Text color={theme.warning}>
                                    {side === 'left' ? 'Loading...' : ''}
                                </Text>
                            </Box>
                        )
                    }
                    return (
                        <Box flexDirection='column'>
                            {visibleVisualRows.map((vRow, i) =>
                                renderRowHalf(vRow, scrollOffset + i, side),
                            )}
                        </Box>
                    )
                }

                return (
                    <Box
                        flexDirection='row'
                        flexGrow={1}
                    >
                        <PanelBox
                            title={truncatePathLeft(
                                leftPath,
                                Math.max(0, leftInner - 3),
                            )}
                            borderColor={leftBorderColor}
                            side='left'
                        >
                            {renderPanelContents('left')}
                        </PanelBox>
                        <PanelBox
                            title={truncatePathLeft(
                                rightPath,
                                Math.max(0, rightInner - 3),
                            )}
                            borderColor={rightBorderColor}
                            side='right'
                        >
                            {renderPanelContents('right')}
                        </PanelBox>
                    </Box>
                )
            })()}

            {/* Footer */}
            <Box justifyContent='space-between'>
                <Text dimColor>
                    {!diffRows ?
                        ''
                    : isLineMode && changeLineIndices.length > 0 ?
                        ` LINE ${lineCursor + 1} of ${changeLineIndices.length}`
                    : hunkRanges.length > 0 ?
                        ` hunk ${focusedHunk + 1} of ${hunkRanges.length}`
                    :   ''}
                </Text>
                <Box>
                    <Text
                        color={wrapMode ? theme.statusBarMode : undefined}
                        dimColor={!wrapMode}
                    >{`wrap${wrapKey ? ` (${wrapKey})` : ''} `}</Text>
                    <Text
                        dimColor
                    >{`context ${contextSize}${contextKeyHint ? ` (${contextKeyHint})` : ''} `}</Text>
                </Box>
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
