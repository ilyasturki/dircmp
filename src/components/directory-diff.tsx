import os from 'node:os'
import { Box } from 'ink'

import type { CompareEntry, PanelSide } from '~/utils/types'

const homeDir = os.homedir()
import { DirectoryPanel } from '~/components/directory-panel'

interface DirectoryDiffProps {
    leftDir: string
    rightDir: string
    entries: CompareEntry[]
    cursorIndex: number
    focusedPanel: PanelSide
    dialogOpen: boolean
    visibleHeight: number
    scrollOffset: number
    searchQuery: string
}

export function DirectoryDiff({
    leftDir,
    rightDir,
    entries,
    cursorIndex,
    focusedPanel,
    dialogOpen,
    visibleHeight,
    scrollOffset,
    searchQuery,
}: DirectoryDiffProps) {
    return (
        <Box flexGrow={1}>
            <DirectoryPanel
                rootPath={leftDir.replace(homeDir, '~')}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={!dialogOpen && focusedPanel === 'left'}
                side='left'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
                searchQuery={searchQuery}
            />
            <DirectoryPanel
                rootPath={rightDir.replace(homeDir, '~')}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={!dialogOpen && focusedPanel === 'right'}
                side='right'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
                searchQuery={searchQuery}
            />
        </Box>
    )
}
