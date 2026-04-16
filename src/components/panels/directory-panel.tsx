import path from 'node:path'
import { Box, Text } from 'ink'
import { memo } from 'react'

import type { AppState, CompareEntry, PanelSide } from '~/utils/types'
import { borderFor } from '~/utils/theme'
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
    pendingPairMark: AppState['pendingPairMark']
    columns: number
}

function EmptyPanel() {
    return (
        <Box>
            <Text dimColor>(empty)</Text>
        </Box>
    )
}

export const DirectoryPanel = memo(function DirectoryPanel({
    rootPath,
    entries,
    cursorIndex,
    isFocused,
    side,
    visibleHeight,
    scrollOffset,
    searchQuery,
    pendingPairMark,
    columns,
}: DirectoryPanelProps) {
    const panelWidth = Math.floor(columns / 2) - 2

    const visibleEntries = entries.slice(
        scrollOffset,
        scrollOffset + visibleHeight,
    )

    return (
        <PanelBox
            title={rootPath}
            borderColor={borderFor(isFocused)}
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
                        + (entry.type === 'directory' ? '-d'
                        : entry.type === 'symlink' ? '-l'
                        : '-f')

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
                    const displayName =
                        entry.pairedLeftPath && entry.pairedRightPath ?
                            side === 'left' ?
                                path.basename(entry.pairedLeftPath)
                            :   path.basename(entry.pairedRightPath)
                        :   undefined

                    const isPendingPairMark =
                        pendingPairMark !== null
                        && pendingPairMark.relativePath === entry.relativePath
                        && pendingPairMark.side === side

                    return (
                        <EntryRow
                            key={entryKey}
                            entry={entry}
                            displayName={displayName}
                            fileEntry={fileEntry}
                            isSelected={isSelected}
                            isDimSelected={isDimSelected}
                            panelWidth={panelWidth}
                            searchQuery={searchQuery}
                            isPendingPairMark={isPendingPairMark}
                        />
                    )
                })
            }
        </PanelBox>
    )
})
