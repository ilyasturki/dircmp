import type { AppConfig } from '~/utils/config'
import type { Action, AppState, CompareEntry, PanelSide } from '~/utils/types'
import { buildVisibleTree } from '~/utils/compare'

export function createInitialState(init: {
    config: AppConfig
    ignoreEnabled: boolean
}): AppState {
    return {
        focusedPanel: 'left',
        expandedDirs: new Set(),
        cursorIndex: 0,
        scrollOffset: 0,
        leftScan: null,
        rightScan: null,
        error: null,
        entries: [],
        dialog: null,
        config: init.config,
        swapped: false,
        filterMode: 'all',
        ignoreEnabled: init.ignoreEnabled,
        globalIgnorePatterns: [],
        pairIgnorePatterns: [],
    }
}

function recomputeEntries(state: AppState): CompareEntry[] {
    if (!state.leftScan || !state.rightScan) return []
    return buildVisibleTree(
        state.leftScan,
        state.rightScan,
        state.expandedDirs,
        state.filterMode,
    )
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
            newState.cursorIndex = Math.min(
                state.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            newState.scrollOffset = Math.min(
                state.scrollOffset,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'SCAN_ERROR':
            return { ...state, error: action.error }
        case 'MOVE_CURSOR': {
            if (state.entries.length === 0) return state
            let newIndex = state.cursorIndex
            if (action.direction === 'up') {
                newIndex = Math.max(0, state.cursorIndex - (action.count ?? 1))
            } else if (action.direction === 'down') {
                newIndex = Math.min(
                    state.entries.length - 1,
                    state.cursorIndex + (action.count ?? 1),
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
        case 'TOGGLE_FILTER': {
            const filterMode = state.filterMode === 'all' ? 'diff-only' : 'all'
            const newState = { ...state, filterMode } as AppState
            newState.entries = recomputeEntries(newState)
            newState.cursorIndex = Math.min(
                state.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'COPY_COMPLETE': {
            const destKey = action.side === 'left' ? 'leftScan' : 'rightScan'
            const destScan = state[destKey]
            if (!destScan) return state
            const patched = new Map(destScan)
            for (const fe of action.entries) {
                patched.set(fe.relativePath, fe)
            }
            const newState = { ...state, [destKey]: patched }
            newState.entries = recomputeEntries(newState)
            newState.cursorIndex = Math.min(
                state.cursorIndex,
                Math.max(0, newState.entries.length - 1),
            )
            return newState
        }
        case 'JUMP_TO_DIFF': {
            if (!state.leftScan || !state.rightScan) return state
            if (state.entries.length === 0) return state

            // Build fully expanded tree to see all files
            const allDirs = new Set<string>()
            for (const [, e] of state.leftScan) {
                if (e.isDirectory) allDirs.add(e.relativePath)
            }
            for (const [, e] of state.rightScan) {
                if (e.isDirectory) allDirs.add(e.relativePath)
            }
            const allEntries = buildVisibleTree(
                state.leftScan,
                state.rightScan,
                allDirs,
                state.filterMode,
            )

            // Find current entry in full tree
            const currentPath = state.entries[state.cursorIndex]?.relativePath
            const fullIdx = allEntries.findIndex(
                (e) => e.relativePath === currentPath,
            )
            if (fullIdx === -1) return state

            // Search for next/prev diff file (skip directories)
            let target: CompareEntry | undefined
            if (action.direction === 'next') {
                for (let i = fullIdx + 1; i < allEntries.length; i++) {
                    if (
                        !allEntries[i].isDirectory
                        && allEntries[i].status !== 'identical'
                    ) {
                        target = allEntries[i]
                        break
                    }
                }
            } else {
                for (let i = fullIdx - 1; i >= 0; i--) {
                    if (
                        !allEntries[i].isDirectory
                        && allEntries[i].status !== 'identical'
                    ) {
                        target = allEntries[i]
                        break
                    }
                }
            }
            if (!target) return state

            // Expand all ancestor directories of the target
            const expandedDirs = new Set(state.expandedDirs)
            const parts = target.relativePath.split('/')
            let ancestorPath = ''
            for (let i = 0; i < parts.length - 1; i++) {
                ancestorPath =
                    i === 0 ? parts[i] : ancestorPath + '/' + parts[i]
                expandedDirs.add(ancestorPath)
            }

            // Recompute entries and find target
            const newState = { ...state, expandedDirs }
            newState.entries = recomputeEntries(newState)
            const newIdx = newState.entries.findIndex(
                (e) => e.relativePath === target!.relativePath,
            )
            if (newIdx === -1) return state
            newState.cursorIndex = newIdx
            return newState
        }
        case 'YANK_PATH':
            return state
        case 'COPY_TO_LEFT':
        case 'COPY_TO_RIGHT':
            return state
        case 'CONFIRM_DELETE': {
            const entry = state.entries[state.cursorIndex]
            if (!entry) return state
            const side = state.focusedPanel
            const file = side === 'left' ? entry.left : entry.right
            if (!file) return state
            return { ...state, dialog: 'deleteConfirm' }
        }
        case 'CANCEL_DELETE':
            return { ...state, dialog: null }
        case 'DELETE_COMPLETE':
            return {
                ...state,
                dialog: null,
                leftScan: null,
                rightScan: null,
                entries: [],
            }
        case 'SHOW_CONTEXT_MENU': {
            const entry = state.entries[state.cursorIndex]
            if (!entry) return state
            return { ...state, dialog: 'contextMenu' }
        }
        case 'HIDE_CONTEXT_MENU':
            return { ...state, dialog: null }
        case 'TOGGLE_IGNORE': {
            return {
                ...state,
                ignoreEnabled: !state.ignoreEnabled,
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
            }
        }
        case 'SHOW_IGNORE_DIALOG':
            return { ...state, dialog: 'ignoreDialog' }
        case 'HIDE_IGNORE_DIALOG':
            return { ...state, dialog: null }
        case 'SET_IGNORE_PATTERNS':
            return {
                ...state,
                globalIgnorePatterns: action.global,
                pairIgnorePatterns: action.pair,
            }
        case 'ADD_IGNORE_PATTERN': {
            return {
                ...state,
                pairIgnorePatterns: [
                    ...state.pairIgnorePatterns,
                    action.pattern,
                ],
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
            }
        }
        case 'REMOVE_IGNORE_PATTERN': {
            return {
                ...state,
                pairIgnorePatterns: state.pairIgnorePatterns.filter(
                    (p) => p !== action.pattern,
                ),
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
            }
        }
        case 'UPDATE_IGNORE_PATTERN': {
            return {
                ...state,
                pairIgnorePatterns: state.pairIgnorePatterns.map((p) =>
                    p === action.oldPattern ? action.newPattern : p,
                ),
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
            }
        }
        case 'ADD_GLOBAL_IGNORE_PATTERN': {
            return {
                ...state,
                globalIgnorePatterns: [
                    ...state.globalIgnorePatterns,
                    action.pattern,
                ],
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
            }
        }
        case 'REMOVE_GLOBAL_IGNORE_PATTERN': {
            return {
                ...state,
                globalIgnorePatterns: state.globalIgnorePatterns.filter(
                    (p) => p !== action.pattern,
                ),
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
            }
        }
        case 'UPDATE_GLOBAL_IGNORE_PATTERN': {
            return {
                ...state,
                globalIgnorePatterns: state.globalIgnorePatterns.map((p) =>
                    p === action.oldPattern ? action.newPattern : p,
                ),
                leftScan: null,
                rightScan: null,
                entries: [],
                cursorIndex: 0,
                scrollOffset: 0,
            }
        }
        case 'REDRAW':
            return { ...state }
        case 'SHOW_HELP':
            return { ...state, dialog: 'help' }
        case 'HIDE_HELP':
            return { ...state, dialog: null }
        case 'TOGGLE_PREFERENCES':
            return {
                ...state,
                dialog: state.dialog === 'preferences' ? null : 'preferences',
            }
        case 'UPDATE_CONFIG':
            return { ...state, config: action.config }
        default:
            return state
    }
}
