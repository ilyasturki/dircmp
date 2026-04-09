import path from 'node:path'
import { Box, Text, useStdout } from 'ink'

import type { CompareEntry, FileEntry, PanelSide } from '~/utils/types'
import { EntryRow, MissingEntryRow } from './entry-row'
import { PanelBox } from './panel-box'

interface DirectoryPanelProps {
    rootPath: string
    entries: CompareEntry[]
    cursorIndex: number
    isFocused: boolean
    side: PanelSide
    visibleHeight: number
    scrollOffset: number
    searchQuery: string
}

function EmptyPanel() {
    return (
        <Box>
            <Text dimColor>(empty)</Text>
        </Box>
    )
}

export function DirectoryPanel({
    rootPath,
    entries,
    cursorIndex,
    isFocused,
    side,
    visibleHeight,
    scrollOffset,
    searchQuery,
}: DirectoryPanelProps) {
    const { stdout } = useStdout()
    const columns = stdout?.columns ?? 80
    const panelWidth = Math.floor(columns / 2) - 2

    const visibleEntries = entries.slice(
        scrollOffset,
        scrollOffset + visibleHeight,
    )

    return (
        <PanelBox
            title={rootPath}
            borderColor={isFocused ? 'cyan' : 'gray'}
            side={side}
        >
            {entries.length === 0 ?
                <EmptyPanel />
            :   visibleEntries.map((entry, i) => {
                    const absoluteIndex = scrollOffset + i
                    const isCursorRow = absoluteIndex === cursorIndex
                    const isSelected = isCursorRow && isFocused
                    const isDimSelected = isCursorRow && !isFocused
                    const isPaired = !!entry.pairedLeftPath
                    const isMissingSide =
                        !isPaired
                        && ((side === 'left' && entry.status === 'only-right')
                            || (side === 'right'
                                && entry.status === 'only-left'))

                    const entryKey =
                        entry.relativePath
                        + '-'
                        + side
                        + (entry.isDirectory ? '-d' : '-f')

                    if (isMissingSide) {
                        return (
                            <MissingEntryRow
                                key={entryKey}
                                isSelected={isSelected}
                                isDimSelected={isDimSelected}
                                panelWidth={panelWidth}
                            />
                        )
                    }

                    const fileEntry = side === 'left' ? entry.left : entry.right

                    // For paired entries, show each side's own name
                    let displayEntry = entry
                    if (entry.pairedLeftPath && entry.pairedRightPath) {
                        const displayName =
                            side === 'left' ?
                                path.basename(entry.pairedLeftPath)
                            :   path.basename(entry.pairedRightPath)
                        displayEntry = { ...entry, name: displayName }
                    }

                    return (
                        <EntryRow
                            key={entryKey}
                            entry={displayEntry}
                            fileEntry={fileEntry}
                            isSelected={isSelected}
                            isDimSelected={isDimSelected}
                            panelWidth={panelWidth}
                            searchQuery={searchQuery}
                        />
                    )
                })
            }
        </PanelBox>
    )
}
