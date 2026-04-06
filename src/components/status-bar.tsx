import fsp from 'node:fs/promises'
import path from 'node:path'
import type { Dispatch } from 'react'
import { diffLines } from 'diff'
import { Box, Text } from 'ink'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Shortcut } from '~/keymap'
import type { Action, CompareEntry, FilterMode, ScanResult } from '~/utils/types'
import { countDescendantDiffs } from '~/utils/compare'
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
    searchInputActive: boolean
    searchQuery: string
    columns: number
    entryCount: number
    dispatch: Dispatch<Action>
}

const MAX_DIFF_SIZE = 1_000_000

function useLineDiffCount(
    entry: CompareEntry | undefined,
    leftDir: string,
    rightDir: string,
): number | null {
    const [count, setCount] = useState<number | null>(null)
    const prevPathRef = useRef<string | null>(null)

    useEffect(() => {
        if (
            !entry
            || entry.isDirectory
            || entry.status !== 'modified'
            || !entry.left
            || !entry.right
        ) {
            setCount(null)
            prevPathRef.current = null
            return
        }

        if (prevPathRef.current === entry.relativePath) return
        prevPathRef.current = entry.relativePath

        if (
            entry.left.size > MAX_DIFF_SIZE
            || entry.right.size > MAX_DIFF_SIZE
        ) {
            setCount(null)
            return
        }

        let cancelled = false
        const relPath = entry.relativePath

        async function compute() {
            try {
                const leftPath = path.join(leftDir, relPath)
                const rightPath = path.join(rightDir, relPath)
                const [leftContent, rightContent] = await Promise.all([
                    fsp.readFile(leftPath, 'utf-8'),
                    fsp.readFile(rightPath, 'utf-8'),
                ])
                const changes = diffLines(leftContent, rightContent)
                let diffLineCount = 0
                for (const change of changes) {
                    if (change.added || change.removed) {
                        diffLineCount += change.count ?? 0
                    }
                }
                if (!cancelled) setCount(diffLineCount)
            } catch {
                if (!cancelled) setCount(null)
            }
        }

        setCount(null)
        compute()

        return () => {
            cancelled = true
        }
    }, [
        entry?.relativePath,
        entry?.status,
        entry?.isDirectory,
        leftDir,
        rightDir,
    ])

    return count
}

function getEntryInfo(
    entry: CompareEntry | undefined,
    leftScan: ScanResult | null,
    rightScan: ScanResult | null,
    lineDiffCount: number | null,
    compareDates: boolean,
    dateFormatter: Intl.DateTimeFormat,
): string {
    if (!entry) return ''

    switch (entry.status) {
        case 'identical':
            return 'identical'
        case 'only-left':
            return 'only in left'
        case 'only-right':
            return 'only in right'
        case 'modified':
            if (entry.isDirectory) {
                if (!leftScan || !rightScan) return ''
                const count = countDescendantDiffs(
                    leftScan,
                    rightScan,
                    entry.relativePath,
                    { compareDates },
                )
                return `${count} different file${count !== 1 ? 's' : ''}`
            }
            if (lineDiffCount === null) return '...'
            if (lineDiffCount === 0) {
                const leftDate = entry.left ? dateFormatter.format(entry.left.modifiedTime) : ''
                const rightDate = entry.right ? dateFormatter.format(entry.right.modifiedTime) : ''
                return `${leftDate} → ${rightDate}`
            }
            return `${lineDiffCount} different line${lineDiffCount !== 1 ? 's' : ''}`
        default:
            return ''
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
    searchInputActive,
    searchQuery,
    columns,
    entryCount,
    dispatch,
}: StatusBarProps) {
    const lineDiffCount = useLineDiffCount(focusedEntry, leftDir, rightDir)
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

    if (isLoading) {
        return (
            <Box flexDirection='column'>
                <Text color='yellow'>Scanning directories...</Text>
                <Text> </Text>
            </Box>
        )
    }

    const filterLabel = filterMode === 'all' ? '[all]' : '[diff only]'

    const helpItems = keymap
        .filter((s) => s.keyLabel !== '')
        .map((s) => ({ key: s.keyLabel, label: s.description }))

    const entryInfo = getEntryInfo(
        focusedEntry,
        leftScan,
        rightScan,
        lineDiffCount,
        compareDates,
        dateFormatter,
    )

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
                        <Text color='cyan'>{filterLabel} </Text>
                        {ignoreEnabled && <Text color='cyan'>[ignore] </Text>}
                        {searchQuery !== '' && (
                            <Text color='cyan'>[filter: {searchQuery}] </Text>
                        )}
                        {entryInfo !== '' && <Text dimColor>{entryInfo}</Text>}
                    </Box>
                    {toastMessage && <Text dimColor>{toastMessage}</Text>}
                </Box>
            }
            {showHints && (
                <Box>
                    <KeyboardHints items={helpItems} columns={columns} />
                </Box>
            )}
        </Box>
    )
}
