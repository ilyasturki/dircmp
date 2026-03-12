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

                    if (isMissingSide) {
                        return (
                            <MissingEntryRow
                                key={entry.relativePath + '-' + side}
                                isSelected={isSelected}
                                isDimSelected={isDimSelected}
                            />
                        )
                    }

                    const fileEntry = side === 'left' ? entry.left : entry.right

                    return (
                        <EntryRow
                            key={entry.relativePath + '-' + side}
                            entry={entry}
                            fileEntry={fileEntry}
                            isSelected={isSelected}
                            isDimSelected={isDimSelected}
                        />
                    )
                })
            }
        </PanelBox>
    )
}
