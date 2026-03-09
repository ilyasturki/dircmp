import type { AppState, Action, CompareEntry } from '~/utils/types';
import { buildVisibleTree } from '~/utils/compare';

export const initialState: AppState = {
  focusedPanel: 'left',
  expandedDirs: new Set(),
  cursorIndex: 0,
  scrollOffset: 0,
  leftScan: null,
  rightScan: null,
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
      if (!entry || !entry.isDirectory) return state;
      let expandedDirs: Set<string>;
      if (state.expandedDirs.has(entry.relativePath)) {
        expandedDirs = removeDescendants(state.expandedDirs, entry.relativePath);
      } else {
        expandedDirs = new Set(state.expandedDirs);
        expandedDirs.add(entry.relativePath);
      }
      const newState = {
        ...state,
        expandedDirs,
        cursorIndex: state.cursorIndex,
      };
      newState.entries = recomputeEntries(newState);
      newState.cursorIndex = Math.min(newState.cursorIndex, Math.max(0, newState.entries.length - 1));
      return newState;
    }
    case 'COLLAPSE_PARENT': {
      const entry = state.entries[state.cursorIndex];
      if (!entry) return state;

      const parts = entry.relativePath.split('/');
      if (entry.isDirectory && state.expandedDirs.has(entry.relativePath)) {
        const expandedDirs = removeDescendants(state.expandedDirs, entry.relativePath);
        const newState = { ...state, expandedDirs };
        newState.entries = recomputeEntries(newState);
        newState.cursorIndex = Math.min(state.cursorIndex, Math.max(0, newState.entries.length - 1));
        return newState;
      }

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
      const ancestorIndex = newState.entries.findIndex(e => e.relativePath === foundAncestor);
      newState.cursorIndex = ancestorIndex >= 0 ? ancestorIndex : Math.min(state.cursorIndex, Math.max(0, newState.entries.length - 1));
      return newState;
    }
    case 'REDRAW':
      return { ...state };
    default:
      return state;
  }
}
