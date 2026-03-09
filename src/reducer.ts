import type { AppState, Action, CompareEntry } from '~/utils/types';
import { buildVisibleTree } from '~/utils/compare';
import { getDiffLineCount } from '~/components/file-diff';

export const initialState: AppState = {
  viewMode: 'browser',
  focusedPanel: 'left',
  expandedDirs: new Set(),
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
  return buildVisibleTree(state.leftScan, state.rightScan, state.expandedDirs);
}

function removeDescendants(expandedDirs: Set<string>, dirPath: string): Set<string> {
  const prefix = dirPath + '/';
  const next = new Set(expandedDirs);
  next.delete(dirPath);
  for (const p of next) {
    if (p.startsWith(prefix)) next.delete(p);
  }
  return next;
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
      } else if (action.direction === 'down') {
        newIndex = Math.min(state.entries.length - 1, state.cursorIndex + 1);
      } else if (action.direction === 'top') {
        newIndex = 0;
      } else {
        newIndex = state.entries.length - 1;
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
        let expandedDirs: Set<string>;
        if (state.expandedDirs.has(entry.relativePath)) {
          // Collapse: remove this dir and all descendants
          expandedDirs = removeDescendants(state.expandedDirs, entry.relativePath);
        } else {
          // Expand
          expandedDirs = new Set(state.expandedDirs);
          expandedDirs.add(entry.relativePath);
        }
        const newState = {
          ...state,
          expandedDirs,
          cursorIndex: state.cursorIndex,
        };
        newState.entries = recomputeEntries(newState);
        // Clamp cursor after collapse may have removed entries
        newState.cursorIndex = Math.min(newState.cursorIndex, Math.max(0, newState.entries.length - 1));
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
    case 'COLLAPSE_PARENT': {
      const entry = state.entries[state.cursorIndex];
      if (!entry) return state;

      // Find nearest expanded ancestor
      const parts = entry.relativePath.split('/');
      // If the entry itself is an expanded dir, collapse it
      if (entry.isDirectory && state.expandedDirs.has(entry.relativePath)) {
        const expandedDirs = removeDescendants(state.expandedDirs, entry.relativePath);
        const newState = { ...state, expandedDirs };
        newState.entries = recomputeEntries(newState);
        newState.cursorIndex = Math.min(state.cursorIndex, Math.max(0, newState.entries.length - 1));
        return newState;
      }

      // Otherwise find the parent directory that is expanded
      // Walk up from the entry's path to find nearest expanded ancestor
      let ancestorPath = '';
      let foundAncestor = '';
      for (let i = 0; i < parts.length - 1; i++) {
        ancestorPath = i === 0 ? parts[i] : ancestorPath + '/' + parts[i];
        if (state.expandedDirs.has(ancestorPath)) {
          foundAncestor = ancestorPath;
        }
      }

      if (!foundAncestor) return state;

      const expandedDirs = removeDescendants(state.expandedDirs, foundAncestor);
      const newState = { ...state, expandedDirs };
      newState.entries = recomputeEntries(newState);
      // Move cursor to the ancestor entry
      const ancestorIndex = newState.entries.findIndex(e => e.relativePath === foundAncestor);
      newState.cursorIndex = ancestorIndex >= 0 ? ancestorIndex : Math.min(state.cursorIndex, Math.max(0, newState.entries.length - 1));
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
