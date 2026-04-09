import { Box, Text } from 'ink'

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
                    const isMissingSide =
                        (side === 'left' && entry.status === 'only-right')
                        || (side === 'right' && entry.status === 'only-left')

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
                            />
                        )
                    }

                    const fileEntry = side === 'left' ? entry.left : entry.right

                    return (
                        <EntryRow
                            key={entryKey}
                            entry={entry}
                            fileEntry={fileEntry}
                            isSelected={isSelected}
                            isDimSelected={isDimSelected}
                            searchQuery={searchQuery}
                        />
                    )
                })
            }
        </PanelBox>
    )
}
