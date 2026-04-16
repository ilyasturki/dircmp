import os from 'node:os'
import { Box } from 'ink'

import type { AppState, CompareEntry, PanelSide } from '~/utils/types'
import { DirectoryPanel } from './directory-panel'

const homeDir = os.homedir()

interface DirectoryDiffProps {
    leftDir: string
    rightDir: string
    leftLabel?: string
    rightLabel?: string
    entries: CompareEntry[]
    cursorIndex: number
    focusedPanel: PanelSide
    dialogOpen: boolean
    visibleHeight: number
    scrollOffset: number
    searchQuery: string
    pendingPairMark: AppState['pendingPairMark']
    columns: number
}

export function DirectoryDiff({
    leftDir,
    rightDir,
    leftLabel,
    rightLabel,
    entries,
    cursorIndex,
    focusedPanel,
    dialogOpen,
    visibleHeight,
    scrollOffset,
    searchQuery,
    pendingPairMark,
    columns,
}: DirectoryDiffProps) {
    return (
        <Box flexGrow={1}>
            <DirectoryPanel
                rootPath={leftLabel ?? leftDir.replace(homeDir, '~')}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={!dialogOpen && focusedPanel === 'left'}
                side='left'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
                searchQuery={searchQuery}
                pendingPairMark={pendingPairMark}
                columns={columns}
            />
            <DirectoryPanel
                rootPath={rightLabel ?? rightDir.replace(homeDir, '~')}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={!dialogOpen && focusedPanel === 'right'}
                side='right'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
                searchQuery={searchQuery}
                pendingPairMark={pendingPairMark}
                columns={columns}
            />
        </Box>
    )
}
