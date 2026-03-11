import type { AppConfig } from '~/utils/config'
import type { Action, AppState, CompareEntry, PanelSide } from '~/utils/types'
import { buildVisibleTree } from '~/utils/compare'

export function createInitialState(config: AppConfig): AppState {
    return {
        focusedPanel: 'left',
        expandedDirs: new Set(),
        cursorIndex: 0,
        scrollOffset: 0,
        leftScan: null,
        rightScan: null,
        error: null,
        entries: [],
        showPreferences: false,
        config,
        swapped: false,
    }
}

function recomputeEntries(state: AppState): CompareEntry[] {
    if (!state.leftScan || !state.rightScan) return []
    return buildVisibleTree(state.leftScan, state.rightScan, state.expandedDirs)
}

function removeDescendants(
    expandedDirs: Set<string>,
    dirPath: string,
): Set<string> {
    const prefix = dirPath + '/'
    const next = new Set(expandedDirs)
    next.delete(dirPath)
    for (const p of next) {
        if (p.startsWith(prefix)) next.delete(p)
    }
    return next
}

export function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'SCAN_COMPLETE': {
            const newState = {
                ...state,
                leftScan: action.leftScan,
                rightScan: action.rightScan,
            }
            newState.entries = recomputeEntries(newState)
            return newState
        }
        case 'SCAN_ERROR':
            return { ...state, error: action.error }
        case 'MOVE_CURSOR': {
            if (state.entries.length === 0) return state
            let newIndex = state.cursorIndex
            if (action.direction === 'up') {
                newIndex = Math.max(0, state.cursorIndex - 1)
            } else if (action.direction === 'down') {
                newIndex = Math.min(
                    state.entries.length - 1,
                    state.cursorIndex + 1,
                )
            } else if (action.direction === 'top') {
                newIndex = 0
            } else {
                newIndex = state.entries.length - 1
            }
            return { ...state, cursorIndex: newIndex }
        }
        case 'SWITCH_PANEL':
            return {
                ...state,
                focusedPanel: state.focusedPanel === 'left' ? 'right' : 'left',
            }
        case 'FOCUS_PANEL':
            return { ...state, focusedPanel: action.panel }
        case 'NAVIGATE_INTO': {
            const entry = state.entries[state.cursorIndex]
            if (!entry || !entry.isDirectory) return state
            let expandedDirs: Set<string>
            if (state.expandedDirs.has(entry.relativePath)) {
                expandedDirs = removeDescendants(
                    state.expandedDirs,
                    entry.relativePath,
                )
            } else {
                expandedDirs = new Set(state.expandedDirs)
                expandedDirs.add(entry.relativePath)
            }
            const newState = {
                ...state,
                expandedDirs,
                cursorIndex: state.cursorIndex,
            }
            newState.entries = recomputeEntries(newState)
            newState.cursorIndex = Math.min(
                newState.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'OPEN_DIFF': {
            const entry = state.entries[state.cursorIndex]
            if (!entry || !entry.isDirectory) return state
            let expandedDirs: Set<string>
            if (state.expandedDirs.has(entry.relativePath)) {
                expandedDirs = removeDescendants(
                    state.expandedDirs,
                    entry.relativePath,
                )
            } else {
                expandedDirs = new Set(state.expandedDirs)
                expandedDirs.add(entry.relativePath)
            }
            const newState = {
                ...state,
                expandedDirs,
                cursorIndex: state.cursorIndex,
            }
            newState.entries = recomputeEntries(newState)
            newState.cursorIndex = Math.min(
                newState.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'COLLAPSE_PARENT': {
            const entry = state.entries[state.cursorIndex]
            if (!entry) return state

            const parts = entry.relativePath.split('/')
            if (
                entry.isDirectory
                && state.expandedDirs.has(entry.relativePath)
            ) {
                const expandedDirs = removeDescendants(
                    state.expandedDirs,
                    entry.relativePath,
                )
                const newState = { ...state, expandedDirs }
                newState.entries = recomputeEntries(newState)
                newState.cursorIndex = Math.min(
                    state.cursorIndex,
                    Math.max(0, newState.entries.length - 1),
                )
                return newState
            }

            let ancestorPath = ''
            let foundAncestor = ''
            for (let i = 0; i < parts.length - 1; i++) {
                ancestorPath =
                    i === 0 ? parts[i] : ancestorPath + '/' + parts[i]
                if (state.expandedDirs.has(ancestorPath)) {
                    foundAncestor = ancestorPath
                }
            }

            if (!foundAncestor) return state

            const expandedDirs = removeDescendants(
                state.expandedDirs,
                foundAncestor,
            )
            const newState = { ...state, expandedDirs }
            newState.entries = recomputeEntries(newState)
            const ancestorIndex = newState.entries.findIndex(
                (e) => e.relativePath === foundAncestor,
            )
            newState.cursorIndex =
                ancestorIndex >= 0 ? ancestorIndex : (
                    Math.min(
                        state.cursorIndex,
                        Math.max(0, newState.entries.length - 1),
                    )
                )
            return newState
        }
        case 'REFRESH': {
            return {
                ...state,
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
                swapped: false,
            }
        }
        case 'SWAP_PANELS': {
            const flippedPanel: PanelSide =
                state.focusedPanel === 'left' ? 'right' : 'left'
            const newState: AppState = {
                ...state,
                leftScan: state.rightScan,
                rightScan: state.leftScan,
                swapped: !state.swapped,
                focusedPanel: flippedPanel,
            }
            newState.entries = recomputeEntries(newState)
            newState.cursorIndex = Math.min(
                state.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'EXPAND_ALL': {
            if (!state.leftScan || !state.rightScan) return state
            const expandedDirs = new Set<string>()
            for (const [, entry] of state.leftScan) {
                if (entry.isDirectory) expandedDirs.add(entry.relativePath)
            }
            for (const [, entry] of state.rightScan) {
                if (entry.isDirectory) expandedDirs.add(entry.relativePath)
            }
            const newState = { ...state, expandedDirs }
            newState.entries = recomputeEntries(newState)
            newState.cursorIndex = Math.min(
                state.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'COLLAPSE_ALL': {
            const newState = { ...state, expandedDirs: new Set<string>() }
            newState.entries = recomputeEntries(newState)
            newState.cursorIndex = Math.min(
                state.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'REDRAW':
            return { ...state }
        case 'TOGGLE_PREFERENCES':
            return { ...state, showPreferences: !state.showPreferences }
        case 'UPDATE_CONFIG':
            return { ...state, config: action.config }
        default:
            return state
    }
}
