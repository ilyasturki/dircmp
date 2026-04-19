import type { Dispatch, ReactNode } from 'react'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { diffLines } from 'diff'
import { Box, Text } from 'ink'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Shortcut } from '~/keymap'
import type {
    Action,
    CompareEntry,
    FilterMode,
    PairableType,
    PanelSide,
    ScanResult,
    SortDirection,
    SortMode,
} from '~/utils/types'
import { isBinary } from '~/utils/binary'
import { countDescendantDiffs } from '~/utils/compare'
import { formatSize } from '~/utils/format-size'
import { theme } from '~/utils/theme'
import { KeyboardHints } from './keyboard-hints'
import { SearchInput } from './search-input'

interface StatusBarProps {
    isLoading: boolean
    keymap: Shortcut[]
    filterMode: FilterMode
    ignoreEnabled: boolean
    focusedEntry: CompareEntry | undefined
    leftDir: string
    rightDir: string
    leftScan: ScanResult | null
    rightScan: ScanResult | null
    toastMessage: string | null
    showHints: boolean
    compareDates: boolean
    compareContents: boolean
    searchInputActive: boolean
    searchQuery: string
    columns: number
    entryCount: number
    dispatch: Dispatch<Action>
    pendingPairMark: {
        relativePath: string
        side: PanelSide
        type: PairableType
    } | null
    sortMode: SortMode
    sortDirection: SortDirection
}

const MAX_DIFF_SIZE = 1_000_000

interface LineDiffStats {
    added: number
    removed: number
}

type LineDiffResult =
    | { type: 'loading' }
    | { type: 'binary' }
    | { type: 'dateOnly' }
    | { type: 'stats'; stats: LineDiffStats }

function useLineDiff(
    entry: CompareEntry | undefined,
    leftDir: string,
    rightDir: string,
): LineDiffResult | null {
    const [result, setResult] = useState<LineDiffResult | null>(null)
    const prevPathRef = useRef<string | null>(null)

    useEffect(() => {
        if (
            !entry
            || entry.type !== 'file'
            || entry.status !== 'modified'
            || !entry.left
            || !entry.right
        ) {
            setResult(null)
            prevPathRef.current = null
            return
        }

        if (prevPathRef.current === entry.relativePath) return
        prevPathRef.current = entry.relativePath

        if (
            entry.left.size > MAX_DIFF_SIZE
            || entry.right.size > MAX_DIFF_SIZE
        ) {
            setResult(null)
            return
        }

        let cancelled = false
        const relPath = entry.relativePath

        async function compute() {
            try {
                const leftPath = path.join(leftDir, relPath)
                const rightPath = path.join(rightDir, relPath)
                const [leftBuf, rightBuf] = await Promise.all([
                    fsp.readFile(leftPath),
                    fsp.readFile(rightPath),
                ])
                if (isBinary(leftBuf) || isBinary(rightBuf)) {
                    if (!cancelled) setResult({ type: 'binary' })
                    return
                }
                const changes = diffLines(
                    leftBuf.toString('utf-8'),
                    rightBuf.toString('utf-8'),
                )
                let added = 0
                let removed = 0
                for (const change of changes) {
                    if (change.added) added += change.count ?? 0
                    else if (change.removed) removed += change.count ?? 0
                }
                if (added === 0 && removed === 0) {
                    if (!cancelled) setResult({ type: 'dateOnly' })
                } else {
                    if (!cancelled)
                        setResult({ type: 'stats', stats: { added, removed } })
                }
            } catch {
                if (!cancelled) setResult(null)
            }
        }

        setResult({ type: 'loading' })
        compute()

        return () => {
            cancelled = true
        }
    }, [entry?.relativePath, entry?.status, entry?.type, leftDir, rightDir])

    return result
}

type DirDiffResult = { type: 'loading' } | { type: 'count'; count: number }

function useDirDiffCount(
    entry: CompareEntry | undefined,
    leftScan: ScanResult | null,
    rightScan: ScanResult | null,
    compareDates: boolean,
    compareContents: boolean,
): DirDiffResult | null {
    const [result, setResult] = useState<DirDiffResult | null>(null)

    useEffect(() => {
        if (!entry || entry.type !== 'directory' || !leftScan || !rightScan) {
            setResult(null)
            return
        }

        const isPaired =
            entry.pairedLeftPath != null && entry.pairedRightPath != null
        if (!isPaired && entry.status !== 'modified') {
            setResult(null)
            return
        }

        const leftPath = entry.pairedLeftPath ?? entry.relativePath
        const rightPath = entry.pairedRightPath ?? entry.relativePath

        setResult({ type: 'loading' })

        let cancelled = false
        const handle = setTimeout(() => {
            if (cancelled) return
            const count = countDescendantDiffs(
                leftScan,
                rightScan,
                leftPath,
                rightPath,
                { compareDates, compareContents },
            )
            if (!cancelled) setResult({ type: 'count', count })
        }, 0)

        return () => {
            cancelled = true
            clearTimeout(handle)
        }
    }, [
        entry?.relativePath,
        entry?.type,
        entry?.status,
        entry?.pairedLeftPath,
        entry?.pairedRightPath,
        leftScan,
        rightScan,
        compareDates,
        compareContents,
    ])

    return result
}

function sizeInfo(entry: CompareEntry): string {
    if (entry.type === 'directory') return ''
    const leftSize = entry.left?.size
    const rightSize = entry.right?.size
    if (leftSize != null && rightSize != null) {
        if (leftSize === rightSize) return formatSize(leftSize).trim()
        return `${formatSize(leftSize).trim()} → ${formatSize(rightSize).trim()}`
    }
    if (leftSize != null) return formatSize(leftSize).trim()
    if (rightSize != null) return formatSize(rightSize).trim()
    return ''
}

const SEP = ' · '

function joinTextParts(parts: string[]): string {
    return parts.filter((p) => p !== '').join(SEP)
}

function getEntryInfo(
    entry: CompareEntry | undefined,
    dirDiff: DirDiffResult | null,
    lineDiff: LineDiffResult | null,
    dateFormatter: Intl.DateTimeFormat,
): ReactNode | null {
    if (!entry) return null

    const pathPrefix = entry.depth > 0 ? entry.relativePath : ''

    // Paired directory info
    if (entry.pairedLeftPath && entry.pairedRightPath) {
        const leftName = path.basename(entry.pairedLeftPath)
        const rightName = path.basename(entry.pairedRightPath)
        const pairedLabel = `paired: ${leftName}/ → ${rightName}/`
        if (!dirDiff || dirDiff.type === 'loading') {
            return joinTextParts([pathPrefix, `${pairedLabel} (...)`])
        }
        const diffInfo =
            dirDiff.count > 0 ?
                `${dirDiff.count} different file${dirDiff.count !== 1 ? 's' : ''}`
            :   'identical'
        return joinTextParts([pathPrefix, `${pairedLabel} (${diffInfo})`])
    }

    switch (entry.status) {
        case 'identical':
            return joinTextParts([pathPrefix, 'identical', sizeInfo(entry)])
        case 'only-left':
            return joinTextParts([pathPrefix, 'only in left', sizeInfo(entry)])
        case 'only-right':
            return joinTextParts([pathPrefix, 'only in right', sizeInfo(entry)])
        case 'modified': {
            if (entry.type === 'directory') {
                if (!dirDiff || dirDiff.type === 'loading')
                    return joinTextParts([pathPrefix, '...'])
                return joinTextParts([
                    pathPrefix,
                    `${dirDiff.count} different file${dirDiff.count !== 1 ? 's' : ''}`,
                ])
            }
            if (!lineDiff || lineDiff.type === 'loading')
                return joinTextParts([pathPrefix, '...'])
            if (lineDiff.type === 'binary')
                return joinTextParts([
                    pathPrefix,
                    'binary files differ',
                    sizeInfo(entry),
                ])
            if (lineDiff.type === 'dateOnly') {
                const leftDate =
                    entry.left ?
                        dateFormatter.format(entry.left.modifiedTime)
                    :   ''
                const rightDate =
                    entry.right ?
                        dateFormatter.format(entry.right.modifiedTime)
                    :   ''
                return joinTextParts([
                    pathPrefix,
                    `${leftDate} → ${rightDate}`,
                    sizeInfo(entry),
                ])
            }
            const { added, removed } = lineDiff.stats
            const prefix = joinTextParts([pathPrefix])
            const suffix = joinTextParts([sizeInfo(entry)])
            return (
                <>
                    {prefix !== '' && `${prefix}${SEP}`}
                    <Text color={theme.diffAddedCount}>+{added}</Text>{' '}
                    <Text color={theme.diffRemovedCount}>-{removed}</Text>
                    {suffix !== '' && `${SEP}${suffix}`}
                </>
            )
        }
        default:
            return null
    }
}

export function StatusBar({
    isLoading,
    keymap,
    filterMode,
    ignoreEnabled,
    focusedEntry,
    leftDir,
    rightDir,
    leftScan,
    rightScan,
    toastMessage,
    showHints,
    compareDates,
    compareContents,
    searchInputActive,
    searchQuery,
    columns,
    entryCount,
    dispatch,
    pendingPairMark,
    sortMode,
    sortDirection,
}: StatusBarProps) {
    const lineDiff = useLineDiff(focusedEntry, leftDir, rightDir)
    const dirDiff = useDirDiffCount(
        focusedEntry,
        leftScan,
        rightScan,
        compareDates,
        compareContents,
    )
    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(undefined, {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3,
                hour12: false,
            }),
        [],
    )

    const entryInfo = useMemo(
        () => getEntryInfo(focusedEntry, dirDiff, lineDiff, dateFormatter),
        [
            focusedEntry?.relativePath,
            focusedEntry?.status,
            focusedEntry?.type,
            focusedEntry?.pairedLeftPath,
            focusedEntry?.pairedRightPath,
            dirDiff,
            lineDiff,
            dateFormatter,
        ],
    )

    if (isLoading) {
        return (
            <Box flexDirection='column'>
                <Text color={theme.loading}>Scanning directories...</Text>
                <Text> </Text>
            </Box>
        )
    }

    const keyFor = (id: string) =>
        keymap.find((s) => s.id === id)?.helpKey ?? ''
    const filterKey = keyFor('filterMenu')
    const sortKey = keyFor('sortMenu')
    const reverseSortKey = keyFor('reverseSortDirection')
    const toggleIgnoreKey = keyFor('toggleIgnore')
    const ignorePatternsKey = keyFor('ignorePatterns')

    const filterLabel = `[${filterMode} (${filterKey})]`
    const sortArrow = sortDirection === 'asc' ? '↑' : '↓'
    const sortLabel = `[${sortMode} ${sortArrow} (${sortKey}/${reverseSortKey})]`
    const ignoreLabel = `[ignore (${toggleIgnoreKey}/${ignorePatternsKey})]`

    const helpItems = keymap
        .filter((s) => s.keyLabel !== '' && s.mode !== 'fileDiff')
        .map((s) => ({ key: s.keyLabel, label: s.description }))

    return (
        <Box flexDirection='column'>
            {searchInputActive ?
                <SearchInput
                    initialQuery={searchQuery}
                    matchCount={entryCount}
                    dispatch={dispatch}
                />
            :   <Box justifyContent='space-between'>
                    <Box>
                        <Text color={theme.statusBarMode}>{filterLabel} </Text>
                        <Text color={theme.statusBarMode}>{sortLabel} </Text>
                        <Text
                            color={
                                ignoreEnabled ? theme.statusBarMode : undefined
                            }
                            dimColor={!ignoreEnabled}
                        >
                            {ignoreLabel}{' '}
                        </Text>
                        {pendingPairMark && (
                            <Text color={theme.entryPairMark}>
                                [pair:{' '}
                                {path.basename(pendingPairMark.relativePath)}
                                {pendingPairMark.type === 'directory' ?
                                    '/'
                                :   ''}
                                ]{' '}
                            </Text>
                        )}
                        {searchQuery !== '' && (
                            <Text color={theme.statusBarMode}>
                                [filter: {searchQuery}]{' '}
                            </Text>
                        )}
                        {entryInfo != null && <Text dimColor>{entryInfo}</Text>}
                    </Box>
                    {toastMessage && <Text dimColor>{toastMessage}</Text>}
                </Box>
            }
            {showHints && (
                <Box>
                    <KeyboardHints
                        items={helpItems}
                        columns={columns}
                    />
                </Box>
            )}
        </Box>
    )
}
