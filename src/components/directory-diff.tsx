import { Box } from 'ink';
import { DirectoryPanel } from '~/components/directory-panel.js';
import type { CompareEntry, PanelSide } from '~/utils/types.js';

interface DirectoryDiffProps {
  leftDir: string;
  rightDir: string;
  currentPath: string;
  entries: CompareEntry[];
  cursorIndex: number;
  focusedPanel: PanelSide;
  visibleHeight: number;
  scrollOffset: number;
}

export function DirectoryDiff({
  leftDir,
  rightDir,
  currentPath,
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
        currentPath={currentPath}
        entries={entries}
        cursorIndex={cursorIndex}
        isFocused={focusedPanel === 'left'}
        side="left"
        visibleHeight={visibleHeight}
        scrollOffset={scrollOffset}
      />
      <DirectoryPanel
        rootPath={rightDir}
        currentPath={currentPath}
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
