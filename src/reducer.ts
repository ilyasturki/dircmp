import type { AppState, Action, CompareEntry } from '~/types.js';
import { compareAtPath } from '~/compare.js';
import { getDiffLineCount } from '~/components/diff-view.js';

export const initialState: AppState = {
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

export function reducer(state: AppState, action: Action): AppState {
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
