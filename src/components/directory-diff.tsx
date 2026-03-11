import { Box } from 'ink'

import type { CompareEntry, PanelSide } from '~/utils/types'
import { DirectoryPanel } from '~/components/directory-panel'

interface DirectoryDiffProps {
    leftDir: string
    rightDir: string
    entries: CompareEntry[]
    cursorIndex: number
    focusedPanel: PanelSide
    visibleHeight: number
    scrollOffset: number
    dateLocale: string | undefined
}

export function DirectoryDiff({
    leftDir,
    rightDir,
    entries,
    cursorIndex,
    focusedPanel,
    visibleHeight,
    scrollOffset,
    dateLocale,
}: DirectoryDiffProps) {
    return (
        <Box flexGrow={1}>
            <DirectoryPanel
                rootPath={leftDir}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={focusedPanel === 'left'}
                side='left'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
                dateLocale={dateLocale}
            />
            <DirectoryPanel
                rootPath={rightDir}
                entries={entries}
                cursorIndex={cursorIndex}
                isFocused={focusedPanel === 'right'}
                side='right'
                visibleHeight={visibleHeight}
                scrollOffset={scrollOffset}
                dateLocale={dateLocale}
            />
        </Box>
    )
}
