import { Box } from 'ink';
import { DirectoryPanel } from '~/components/directory-panel';
import type { CompareEntry, PanelSide } from '~/utils/types';

interface DirectoryDiffProps {
  leftDir: string;
  rightDir: string;
  entries: CompareEntry[];
  cursorIndex: number;
  focusedPanel: PanelSide;
  visibleHeight: number;
  scrollOffset: number;
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
        rootPath={leftDir}
        entries={entries}
        cursorIndex={cursorIndex}
        isFocused={focusedPanel === 'left'}
        side="left"
        visibleHeight={visibleHeight}
        scrollOffset={scrollOffset}
      />
      <DirectoryPanel
        rootPath={rightDir}
        entries={entries}
        cursorIndex={cursorIndex}
        isFocused={focusedPanel === 'right'}
        side="right"
        visibleHeight={visibleHeight}
        scrollOffset={scrollOffset}
      />
    </Box>
  );
}
