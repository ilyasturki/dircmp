import type { AppConfig } from '~/utils/config'
import type { Action, AppState, CompareEntry, PanelSide } from '~/utils/types'
import { buildVisibleTree, filterByMode } from '~/utils/compare'
import { pushUndo } from '~/utils/undo'

export function createInitialState(init: {
    config: AppConfig
    ignoreEnabled: boolean
}): AppState {
    return {
        view: 'directoryDiff',
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
        fileDiffEntryIndex: null,
        keybindingVersion: 0,
        searchQuery: '',
        searchInputActive: false,
        pendingPairMark: null,
        manualPairings: new Map(),
        sortMode: 'name',
        sortDirection: 'asc',
        undoStack: [],
        redoStack: [],
    }
}

function filterBySearch(
    entries: CompareEntry[],
    query: string,
): CompareEntry[] {
    if (!query) return entries
    const lowerQuery = query.toLowerCase()

    // Find entries whose name directly matches
    const directMatches = new Set<string>()
    for (const entry of entries) {
        if (entry.name.toLowerCase().includes(lowerQuery)) {
            directMatches.add(entry.relativePath)
        }
    }

    // Collect prefixes of matching directories (to keep descendants)
    const matchingDirPrefixes: string[] = []
    for (const entry of entries) {
        if (entry.isDirectory && directMatches.has(entry.relativePath)) {
            matchingDirPrefixes.push(entry.relativePath + '/')
        }
    }

    // Build set of all paths to keep
    const keepPaths = new Set<string>()
    for (const entry of entries) {
        if (directMatches.has(entry.relativePath)) {
            keepPaths.add(entry.relativePath)
        } else {
            for (const prefix of matchingDirPrefixes) {
                if (entry.relativePath.startsWith(prefix)) {
                    keepPaths.add(entry.relativePath)
                    break
                }
            }
        }
    }

    // Add ancestor directories for all kept entries
    for (const relPath of [...keepPaths]) {
        const parts = relPath.split('/')
        let ancestor = ''
        for (let i = 0; i < parts.length - 1; i++) {
            ancestor = i === 0 ? parts[i]! : ancestor + '/' + parts[i]
            keepPaths.add(ancestor)
        }
    }

    return entries.filter((e) => keepPaths.has(e.relativePath))
}

function recomputeEntries(state: AppState): CompareEntry[] {
    if (!state.leftScan || !state.rightScan) return []

    // When searching, expand all directories so the full tree is searchable
    let expandedDirs = state.expandedDirs
    if (state.searchQuery) {
        expandedDirs = new Set<string>()
        for (const [, entry] of state.leftScan) {
            if (entry.isDirectory) expandedDirs.add(entry.relativePath)
        }
        for (const [, entry] of state.rightScan) {
            if (entry.isDirectory) expandedDirs.add(entry.relativePath)
        }
    }

    const tree = buildVisibleTree(
        state.leftScan,
        state.rightScan,
        expandedDirs,
        {
            compareDates: state.config.compareDates,
            compareContents: state.config.compareContents,
        },
        {
            mode: state.sortMode,
            direction: state.sortDirection,
            dirsFirst: state.config.dirsFirst,
        },
        state.manualPairings.size > 0 ? state.manualPairings : undefined,
    )
    const filtered = filterByMode(tree, state.filterMode)
    return filterBySearch(filtered, state.searchQuery)
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

/** Recompute entries from updated state fields and clamp cursor to bounds. */
function withRecompute(state: AppState, updates: Partial<AppState>): AppState {
    const newState = { ...state, ...updates } as AppState
    newState.entries = recomputeEntries(newState)
    newState.cursorIndex = Math.min(
        state.cursorIndex,
        Math.max(0, newState.entries.length - 1),
    )
    return newState
}

function toggleExpandDir(state: AppState): AppState {
    const entry = state.entries[state.cursorIndex]
    if (!entry || !entry.isDirectory) return state
    const expandedDirs =
        state.expandedDirs.has(entry.relativePath) ?
            removeDescendants(state.expandedDirs, entry.relativePath)
        :   new Set(state.expandedDirs).add(entry.relativePath)
    return withRecompute(state, { expandedDirs })
}

function collectAllDirs(state: AppState): Set<string> {
    const dirs = new Set<string>()
    if (state.leftScan) {
        for (const [, e] of state.leftScan) {
            if (e.isDirectory) dirs.add(e.relativePath)
        }
    }
    if (state.rightScan) {
        for (const [, e] of state.rightScan) {
            if (e.isDirectory) dirs.add(e.relativePath)
        }
    }
    return dirs
}

export function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'SCAN_COMPLETE': {
            const result = withRecompute(state, {
                leftScan: action.leftScan,
                rightScan: action.rightScan,
            })
            result.scrollOffset = Math.min(
                state.scrollOffset,
                Math.max(0, result.entries.length - 1),
            )
            return result
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
        case 'SET_SCROLL_OFFSET':
            return { ...state, scrollOffset: action.offset }
        case 'SCROLL_VIEWPORT': {
            if (state.entries.length === 0) return state
            const h = Math.max(1, action.viewHeight)
            let scrollOffset = state.scrollOffset
            if (action.position === 'center') {
                scrollOffset = state.cursorIndex - Math.floor(h / 2)
            } else if (action.position === 'top') {
                scrollOffset = state.cursorIndex
            } else {
                scrollOffset = state.cursorIndex - h + 1
            }
            scrollOffset = Math.max(0, scrollOffset)
            return { ...state, scrollOffset }
        }
        case 'SCROLL_LINES': {
            if (state.entries.length === 0) return state
            const h = Math.max(1, action.viewHeight)
            const delta =
                action.direction === 'down' ? action.count : -action.count
            const maxScroll = Math.max(0, state.entries.length - h)
            const scrollOffset = Math.max(
                0,
                Math.min(maxScroll, state.scrollOffset + delta),
            )
            let cursorIndex = state.cursorIndex
            if (cursorIndex < scrollOffset) cursorIndex = scrollOffset
            else if (cursorIndex >= scrollOffset + h)
                cursorIndex = scrollOffset + h - 1
            cursorIndex = Math.min(cursorIndex, state.entries.length - 1)
            return { ...state, scrollOffset, cursorIndex }
        }
        case 'SWITCH_PANEL':
            return {
                ...state,
                focusedPanel: state.focusedPanel === 'left' ? 'right' : 'left',
            }
        case 'FOCUS_PANEL':
            return { ...state, focusedPanel: action.panel }
        case 'NAVIGATE_INTO':
        case 'OPEN_FILE_DIFF':
            return toggleExpandDir(state)
        case 'COLLAPSE_PARENT': {
            const entry = state.entries[state.cursorIndex]
            if (!entry) return state

            if (
                entry.isDirectory
                && state.expandedDirs.has(entry.relativePath)
            ) {
                return withRecompute(state, {
                    expandedDirs: removeDescendants(
                        state.expandedDirs,
                        entry.relativePath,
                    ),
                })
            }

            // Find nearest expanded ancestor
            const parts = entry.relativePath.split('/')
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

            const result = withRecompute(state, {
                expandedDirs: removeDescendants(
                    state.expandedDirs,
                    foundAncestor,
                ),
            })
            const ancestorIndex = result.entries.findIndex(
                (e) => e.relativePath === foundAncestor,
            )
            if (ancestorIndex >= 0) result.cursorIndex = ancestorIndex
            return result
        }
        case 'REFRESH':
            return {
                ...state,
                leftScan: null,
                rightScan: null,
                entries: [],
                swapped: false,
                pendingPairMark: null,
            }
        case 'SWAP_PANELS': {
            const swappedPairings = new Map<string, string>()
            for (const [left, right] of state.manualPairings) {
                swappedPairings.set(right, left)
            }
            return withRecompute(state, {
                leftScan: state.rightScan,
                rightScan: state.leftScan,
                swapped: !state.swapped,
                focusedPanel: state.focusedPanel === 'left' ? 'right' : 'left',
                manualPairings: swappedPairings,
                pendingPairMark: null,
            })
        }
        case 'EXPAND_ALL': {
            if (!state.leftScan || !state.rightScan) return state
            return withRecompute(state, {
                expandedDirs: collectAllDirs(state),
            })
        }
        case 'COLLAPSE_ALL':
            return withRecompute(state, {
                expandedDirs: new Set<string>(),
            })
        case 'SHOW_FILTER_MENU':
            return { ...state, dialog: 'filterMenu' }
        case 'SET_FILTER':
            return withRecompute(state, {
                filterMode: action.mode,
                dialog: action.close === false ? state.dialog : null,
            })
        case 'COPY_COMPLETE': {
            const destKey = action.side === 'left' ? 'leftScan' : 'rightScan'
            const destScan = state[destKey]
            if (!destScan) return state
            const patched = new Map(destScan)
            for (const fe of action.entries) {
                patched.set(fe.relativePath, fe)
            }
            const updates: Partial<AppState> = { [destKey]: patched }
            if (action.undo) {
                updates.undoStack = pushUndo(state.undoStack, action.undo)
                updates.redoStack = []
            }
            return withRecompute(state, updates)
        }
        case 'JUMP_TO_DIFF': {
            if (!state.leftScan || !state.rightScan) return state
            if (state.entries.length === 0) return state

            // Build fully expanded tree to see all files
            const allEntries = buildVisibleTree(
                state.leftScan,
                state.rightScan,
                collectAllDirs(state),
                {
                    compareDates: state.config.compareDates,
                    compareContents: state.config.compareContents,
                },
                {
                    mode: state.sortMode,
                    direction: state.sortDirection,
                    dirsFirst: state.config.dirsFirst,
                },
                state.manualPairings.size > 0 ?
                    state.manualPairings
                :   undefined,
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

            const result = withRecompute(state, { expandedDirs })
            const newIdx = result.entries.findIndex(
                (e) => e.relativePath === target!.relativePath,
            )
            if (newIdx === -1) return state
            result.cursorIndex = newIdx
            return result
        }
        case 'YANK_PATH':
        case 'COPY_TO_LEFT':
        case 'COPY_TO_RIGHT':
        case 'COPY_FROM_FOCUSED':
        case 'COPY_HUNK_TO_LEFT':
        case 'COPY_HUNK_TO_RIGHT':
        case 'COPY_HUNK_FROM_FOCUSED':
        case 'UNDO':
        case 'REDO':
            return state
        case 'UNDO_COMPLETE': {
            const undoStack = state.undoStack.slice(0, -1)
            const redoStack = [...state.redoStack, action.entry]
            if (
                action.entry.kind === 'pair'
                || action.entry.kind === 'unpair'
            ) {
                return withRecompute(state, {
                    undoStack,
                    redoStack,
                    manualPairings: new Map(action.entry.beforePairings),
                    expandedDirs: new Set(action.entry.beforeExpandedDirs),
                    pendingPairMark: null,
                })
            }
            return { ...state, undoStack, redoStack }
        }
        case 'REDO_COMPLETE': {
            const redoStack = state.redoStack.slice(0, -1)
            const undoStack = pushUndo(state.undoStack, action.entry)
            if (
                action.entry.kind === 'pair'
                || action.entry.kind === 'unpair'
            ) {
                return withRecompute(state, {
                    undoStack,
                    redoStack,
                    manualPairings: new Map(action.entry.afterPairings),
                    expandedDirs: new Set(action.entry.afterExpandedDirs),
                    pendingPairMark: null,
                })
            }
            return { ...state, undoStack, redoStack }
        }
        case 'CONFIRM_DELETE': {
            const entry = state.entries[state.cursorIndex]
            if (!entry) return state
            const file =
                state.focusedPanel === 'left' ? entry.left : entry.right
            if (!file) return state
            return { ...state, dialog: 'deleteConfirm' }
        }
        case 'CANCEL_DELETE':
        case 'HIDE_CONTEXT_MENU':
        case 'HIDE_QUICK_IGNORE':
        case 'HIDE_IGNORE_DIALOG':
        case 'HIDE_HELP':
        case 'HIDE_KEYBINDINGS_EDITOR':
        case 'HIDE_RELEASE_NOTES':
        case 'HIDE_SORT_MENU':
        case 'HIDE_FILTER_MENU':
            return { ...state, dialog: null }
        case 'DELETE_COMPLETE':
            return {
                ...state,
                dialog: null,
                leftScan: null,
                rightScan: null,
                entries: [],
                undoStack:
                    action.undo ?
                        pushUndo(state.undoStack, action.undo)
                    :   state.undoStack,
                redoStack: action.undo ? [] : state.redoStack,
            }
        case 'SHOW_CONTEXT_MENU': {
            const entry = state.entries[state.cursorIndex]
            if (!entry) return state
            return { ...state, dialog: 'contextMenu' }
        }
        case 'TOGGLE_IGNORE':
            return {
                ...state,
                ignoreEnabled: !state.ignoreEnabled,
                leftScan: null,
                rightScan: null,
                entries: [],
            }
        case 'SHOW_QUICK_IGNORE': {
            const entry = state.entries[state.cursorIndex]
            if (!entry) return state
            return { ...state, dialog: 'quickIgnore' }
        }
        case 'SHOW_IGNORE_DIALOG':
            return { ...state, dialog: 'ignoreDialog' }
        case 'SET_IGNORE_PATTERNS':
            return {
                ...state,
                globalIgnorePatterns: action.global,
                pairIgnorePatterns: action.pair,
            }
        case 'ADD_IGNORE_PATTERN': {
            const key =
                action.scope === 'global' ?
                    'globalIgnorePatterns'
                :   'pairIgnorePatterns'
            return {
                ...state,
                [key]: [...state[key], action.pattern],
                leftScan: null,
                rightScan: null,
                entries: [],
            }
        }
        case 'REMOVE_IGNORE_PATTERN': {
            const key =
                action.scope === 'global' ?
                    'globalIgnorePatterns'
                :   'pairIgnorePatterns'
            return {
                ...state,
                [key]: state[key].filter((p) => p !== action.pattern),
                leftScan: null,
                rightScan: null,
                entries: [],
            }
        }
        case 'UPDATE_IGNORE_PATTERN': {
            const key =
                action.scope === 'global' ?
                    'globalIgnorePatterns'
                :   'pairIgnorePatterns'
            return {
                ...state,
                [key]: state[key].map((p) =>
                    p === action.oldPattern ? action.newPattern : p,
                ),
                leftScan: null,
                rightScan: null,
                entries: [],
            }
        }
        case 'REDRAW':
            return { ...state }
        case 'SHOW_HELP':
            return { ...state, dialog: 'help' }
        case 'SHOW_FILE_DIFF':
            return {
                ...state,
                view: 'fileDiff',
                fileDiffEntryIndex: action.entryIndex,
            }
        case 'HIDE_FILE_DIFF':
            return {
                ...state,
                view: 'directoryDiff',
                dialog: null,
                fileDiffEntryIndex: null,
            }
        case 'TOGGLE_PREFERENCES':
            return {
                ...state,
                dialog: state.dialog === 'preferences' ? null : 'preferences',
            }
        case 'UPDATE_CONFIG': {
            if (
                action.config.compareDates !== state.config.compareDates
                || action.config.compareContents
                    !== state.config.compareContents
                || action.config.dirsFirst !== state.config.dirsFirst
            ) {
                return withRecompute(state, { config: action.config })
            }
            return { ...state, config: action.config }
        }
        case 'SHOW_KEYBINDINGS_EDITOR':
            return { ...state, dialog: 'keybindingsEditor' }
        case 'SHOW_RELEASE_NOTES':
            return { ...state, dialog: 'releaseNotes' }
        case 'KEYBINDINGS_UPDATED':
            return {
                ...state,
                keybindingVersion: state.keybindingVersion + 1,
            }
        case 'OPEN_SEARCH':
            return { ...state, searchInputActive: true }
        case 'SET_SEARCH_QUERY':
            return withRecompute(state, { searchQuery: action.query })
        case 'CLOSE_SEARCH':
            return { ...state, searchInputActive: false }
        case 'CANCEL_SEARCH':
            return withRecompute(state, {
                searchInputActive: false,
                searchQuery: '',
            })
        case 'MARK_PAIR': {
            const entry = state.entries[state.cursorIndex]
            if (!entry || !entry.isDirectory) return state
            if (entry.status !== 'only-left' && entry.status !== 'only-right')
                return state

            const side: PanelSide =
                entry.status === 'only-left' ? 'left' : 'right'

            // Toggle off if pressing on the already-marked entry
            if (
                state.pendingPairMark
                && state.pendingPairMark.relativePath === entry.relativePath
                && state.pendingPairMark.side === side
            ) {
                return { ...state, pendingPairMark: null }
            }

            if (!state.pendingPairMark || state.pendingPairMark.side === side) {
                return {
                    ...state,
                    pendingPairMark: {
                        relativePath: entry.relativePath,
                        side,
                    },
                }
            }

            // Opposite side: create the pairing
            const leftPath =
                side === 'right' ?
                    state.pendingPairMark.relativePath
                :   entry.relativePath
            const rightPath =
                side === 'right' ?
                    entry.relativePath
                :   state.pendingPairMark.relativePath

            // Validate same parent directory
            const leftParent =
                leftPath.includes('/') ?
                    leftPath.substring(0, leftPath.lastIndexOf('/'))
                :   ''
            const rightParent =
                rightPath.includes('/') ?
                    rightPath.substring(0, rightPath.lastIndexOf('/'))
                :   ''
            if (leftParent !== rightParent) {
                return { ...state, pendingPairMark: null }
            }

            const manualPairings = new Map(state.manualPairings)
            manualPairings.set(leftPath, rightPath)
            const pairUndoEntry = {
                kind: 'pair' as const,
                beforePairings: state.manualPairings,
                afterPairings: manualPairings,
                beforeExpandedDirs: state.expandedDirs,
                afterExpandedDirs: state.expandedDirs,
            }
            return withRecompute(state, {
                pendingPairMark: null,
                manualPairings,
                undoStack: pushUndo(state.undoStack, pairUndoEntry),
                redoStack: [],
            })
        }
        case 'CLEAR_PAIR_MARK':
            if (!state.pendingPairMark) return state
            return { ...state, pendingPairMark: null }
        case 'UNPAIR': {
            if (state.pendingPairMark) {
                return { ...state, pendingPairMark: null }
            }
            const entry = state.entries[state.cursorIndex]
            if (!entry || !entry.pairedLeftPath) return state

            const manualPairings = new Map(state.manualPairings)
            manualPairings.delete(entry.pairedLeftPath)

            // Collapse the paired entry and its descendants
            const expandedDirs = new Set(state.expandedDirs)
            expandedDirs.delete(entry.relativePath)
            const prefix = entry.relativePath + '/'
            for (const p of expandedDirs) {
                if (p.startsWith(prefix)) expandedDirs.delete(p)
            }

            const unpairUndoEntry = {
                kind: 'unpair' as const,
                beforePairings: state.manualPairings,
                afterPairings: manualPairings,
                beforeExpandedDirs: state.expandedDirs,
                afterExpandedDirs: expandedDirs,
            }
            return withRecompute(state, {
                manualPairings,
                expandedDirs,
                undoStack: pushUndo(state.undoStack, unpairUndoEntry),
                redoStack: [],
            })
        }
        case 'SHOW_SORT_MENU':
            return { ...state, dialog: 'sortMenu' }
        case 'SET_SORT': {
            const toggleDirection =
                action.mode === state.sortMode ?
                    state.sortDirection === 'asc' ?
                        'desc'
                    :   'asc'
                :   state.sortDirection
            return withRecompute(state, {
                sortMode: action.mode,
                sortDirection: toggleDirection,
                dialog: action.close === false ? state.dialog : null,
            })
        }
        case 'TOGGLE_SORT_DIRECTION':
            return withRecompute(state, {
                sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
            })
        default:
            return state
    }
}
