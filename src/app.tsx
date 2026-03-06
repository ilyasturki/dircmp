import { useReducer, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import type { AppState, Action, CompareEntry } from './types.js';
import { scanDirectory } from './scanner.js';
import { compareAtPath, getFileDiff } from './compare.js';
import { DirPanel } from './components/dir-panel.js';
import { DiffView, getDiffLineCount } from './components/diff-view.js';
import { StatusBar } from './components/status-bar.js';

interface AppProps {
  leftDir: string;
  rightDir: string;
}

const initialState: AppState = {
  viewMode: 'browser',
  focusedPanel: 'left',
  currentPath: '',
  cursorIndex: 0,
  scrollOffset: 0,
  leftScan: null,
  rightScan: null,
  selectedFile: null,
  diffResult: null,
  diffScrollOffset: 0,
  error: null,
  entries: [],
};

function recomputeEntries(state: AppState): CompareEntry[] {
  if (!state.leftScan || !state.rightScan) return [];
  return compareAtPath(state.leftScan, state.rightScan, state.currentPath);
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SCAN_COMPLETE': {
      const newState = {
        ...state,
        leftScan: action.leftScan,
        rightScan: action.rightScan,
      };
      newState.entries = recomputeEntries(newState);
      return newState;
    }
    case 'SCAN_ERROR':
      return { ...state, error: action.error };
    case 'MOVE_CURSOR': {
      if (state.entries.length === 0) return state;
      let newIndex = state.cursorIndex;
      if (action.direction === 'up') {
        newIndex = Math.max(0, state.cursorIndex - 1);
      } else {
        newIndex = Math.min(state.entries.length - 1, state.cursorIndex + 1);
      }
      return { ...state, cursorIndex: newIndex };
    }
    case 'SWITCH_PANEL':
      return {
        ...state,
        focusedPanel: state.focusedPanel === 'left' ? 'right' : 'left',
      };
    case 'NAVIGATE_INTO': {
      const entry = state.entries[state.cursorIndex];
      if (!entry) return state;
      if (entry.isDirectory) {
        const isMissing =
          (state.focusedPanel === 'left' && entry.status === 'only-right') ||
          (state.focusedPanel === 'right' && entry.status === 'only-left');
        if (isMissing) return state;

        const newState = {
          ...state,
          currentPath: entry.relativePath,
          cursorIndex: 0,
          scrollOffset: 0,
        };
        newState.entries = recomputeEntries(newState);
        return newState;
      }
      // File → open diff
      if (entry.status === 'identical') return state;
      return {
        ...state,
        viewMode: 'diff',
        selectedFile: entry.relativePath,
        diffResult: null,
        diffScrollOffset: 0,
      };
    }
    case 'NAVIGATE_UP': {
      if (state.currentPath === '') return state;
      const parts = state.currentPath.split('/');
      parts.pop();
      const newPath = parts.join('/');
      const newState = {
        ...state,
        currentPath: newPath,
        cursorIndex: 0,
        scrollOffset: 0,
      };
      newState.entries = recomputeEntries(newState);
      return newState;
    }
    case 'CLOSE_DIFF':
      return {
        ...state,
        viewMode: 'browser',
        selectedFile: null,
        diffResult: null,
        diffScrollOffset: 0,
      };
    case 'DIFF_LOADED':
      return { ...state, diffResult: action.diffResult };
    case 'SCROLL_DIFF': {
      const totalLines = getDiffLineCount(state.diffResult);
      let newOffset = state.diffScrollOffset;
      if (action.direction === 'up') {
        newOffset = Math.max(0, state.diffScrollOffset - 1);
      } else {
        newOffset = Math.min(Math.max(0, totalLines - 1), state.diffScrollOffset + 1);
      }
      return { ...state, diffScrollOffset: newOffset };
    }
    default:
      return state;
  }
}

export function App({ leftDir, rightDir }: AppProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [dimensions, setDimensions] = useState({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setDimensions({ columns: stdout.columns, rows: stdout.rows });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  useEffect(() => {
    Promise.all([scanDirectory(leftDir), scanDirectory(rightDir)])
      .then(([leftScan, rightScan]) => {
        dispatch({ type: 'SCAN_COMPLETE', leftScan, rightScan });
      })
      .catch((err) => {
        dispatch({ type: 'SCAN_ERROR', error: String(err) });
      });
  }, [leftDir, rightDir]);

  useEffect(() => {
    if (!state.selectedFile) return;
    let cancelled = false;
    getFileDiff(leftDir, rightDir, state.selectedFile).then((result) => {
      if (!cancelled) {
        dispatch({ type: 'DIFF_LOADED', diffResult: result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.selectedFile, leftDir, rightDir]);

  const handleInput = useCallback(
    (input: string, key: { upArrow: boolean; downArrow: boolean; tab: boolean; return: boolean; backspace: boolean; escape: boolean; delete: boolean }) => {
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
    },
    [state.viewMode, exit]
  );

  useInput(handleInput);

  const { columns, rows } = dimensions;

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
