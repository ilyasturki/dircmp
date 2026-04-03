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
    visibleHeight: number
    scrollOffset: number
}

export function DirectoryDiff({
    leftDir,
    rightDir,
    entries,
    cursorIndex,
    focusedPanel,
    visibleHeight,
    scrollOffset,
}: DirectoryDiffProps) {
    return (
        <Box flexGrow={1}>
            <DirectoryPanel
                rootPath={leftDir.replace(homeDir, '~')}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={focusedPanel === 'left'}
                side='left'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
            />
            <DirectoryPanel
                rootPath={rightDir.replace(homeDir, '~')}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={focusedPanel === 'right'}
                side='right'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
            />
        </Box>
    )
}
