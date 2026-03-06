import { useReducer } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { reducer, initialState } from '~/reducer.js';
import { useTerminalDimensions, useDirectoryScan, useFileDiff } from '~/hooks.js';
import { DirPanel } from '~/components/dir-panel.js';
import { DiffView } from '~/components/diff-view.js';
import { StatusBar } from '~/components/status-bar.js';

interface AppProps {
  leftDir: string;
  rightDir: string;
}

export function App({ leftDir, rightDir }: AppProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const { columns, rows } = useTerminalDimensions(stdout);
  useDirectoryScan(leftDir, rightDir, dispatch);
  useFileDiff(state.selectedFile, leftDir, rightDir, dispatch);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (state.viewMode === 'diff') {
      if (key.upArrow) dispatch({ type: 'SCROLL_DIFF', direction: 'up' });
      if (key.downArrow) dispatch({ type: 'SCROLL_DIFF', direction: 'down' });
      if (key.escape) dispatch({ type: 'CLOSE_DIFF' });
      return;
    }

    // Browser mode
    if (key.upArrow) dispatch({ type: 'MOVE_CURSOR', direction: 'up' });
    if (key.downArrow) dispatch({ type: 'MOVE_CURSOR', direction: 'down' });
    if (key.tab) dispatch({ type: 'SWITCH_PANEL' });
    if (key.return) dispatch({ type: 'NAVIGATE_INTO' });
    if (key.backspace || key.delete) dispatch({ type: 'NAVIGATE_UP' });
  });

  if (columns < 40 || rows < 10) {
    return (
      <Box>
        <Text color="red">Terminal too small. Need at least 40x10.</Text>
      </Box>
    );
  }

  const isLoading = !state.leftScan || !state.rightScan;

  if (state.error) {
    return (
      <Box>
        <Text color="red">Error: {state.error}</Text>
      </Box>
    );
  }

  // Reserve rows: 1 for status bar, ~4 for borders/header
  const contentHeight = Math.max(1, rows - 5);

  // Adjust scroll offset to keep cursor in view
  let { scrollOffset } = state;
  if (state.cursorIndex < scrollOffset) {
    scrollOffset = state.cursorIndex;
  } else if (state.cursorIndex >= scrollOffset + contentHeight) {
    scrollOffset = state.cursorIndex - contentHeight + 1;
  }

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {isLoading ? (
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="yellow">Scanning directories...</Text>
        </Box>
      ) : state.viewMode === 'diff' && state.selectedFile ? (
        <Box flexGrow={1}>
          <DiffView
            filePath={state.selectedFile}
            diffResult={state.diffResult}
            scrollOffset={state.diffScrollOffset}
            visibleHeight={contentHeight}
          />
        </Box>
      ) : (
        <Box flexGrow={1}>
          <DirPanel
            rootPath={leftDir}
            currentPath={state.currentPath}
            entries={state.entries}
            cursorIndex={state.cursorIndex}
            isFocused={state.focusedPanel === 'left'}
            side="left"
            visibleHeight={contentHeight}
            scrollOffset={scrollOffset}
          />
          <DirPanel
            rootPath={rightDir}
            currentPath={state.currentPath}
            entries={state.entries}
            cursorIndex={state.cursorIndex}
            isFocused={state.focusedPanel === 'right'}
            side="right"
            visibleHeight={contentHeight}
            scrollOffset={scrollOffset}
          />
        </Box>
      )}
      <StatusBar viewMode={state.viewMode} isLoading={isLoading} />
    </Box>
  );
}
