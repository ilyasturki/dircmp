export interface FileEntry {
    name: string
    relativePath: string
    isDirectory: boolean
    size: number
    modifiedTime: Date
    contentHash: string | null
    error?: string
}

export type DiffStatus = 'identical' | 'modified' | 'only-left' | 'only-right'

export interface CompareEntry {
    relativePath: string
    name: string
    isDirectory: boolean
    status: DiffStatus
    left?: FileEntry
    right?: FileEntry
    depth: number
    isExpanded: boolean
}

export type ScanResult = Map<string, FileEntry>

export type PanelSide = 'left' | 'right'

export type DialogType =
    | 'preferences'
    | 'deleteConfirm'
    | 'contextMenu'
    | 'ignoreDialog'
    | 'help'
    | 'diffView'
    | 'keybindingsEditor'

export type FilterMode = 'all' | 'diff-only'

export type Action =
    | { type: 'SCAN_COMPLETE'; leftScan: ScanResult; rightScan: ScanResult }
    | { type: 'SCAN_ERROR'; error: string }
    | {
          type: 'MOVE_CURSOR'
          direction: 'up' | 'down' | 'top' | 'bottom'
          count?: number
      }
    | { type: 'SWITCH_PANEL' }
    | { type: 'NAVIGATE_INTO' }
    | { type: 'OPEN_DIFF' }
    | { type: 'COLLAPSE_PARENT' }
    | { type: 'REDRAW' }
    | { type: 'TOGGLE_PREFERENCES' }
    | { type: 'UPDATE_CONFIG'; config: import('~/utils/config').AppConfig }
    | { type: 'REFRESH' }
    | { type: 'SWAP_PANELS' }
    | { type: 'FOCUS_PANEL'; panel: PanelSide }
    | { type: 'EXPAND_ALL' }
    | { type: 'COLLAPSE_ALL' }
    | { type: 'TOGGLE_FILTER' }
    | { type: 'COPY_TO_LEFT' }
    | { type: 'COPY_TO_RIGHT' }
    | { type: 'COPY_COMPLETE'; entries: FileEntry[]; side: PanelSide }
    | { type: 'JUMP_TO_DIFF'; direction: 'next' | 'prev' }
    | { type: 'YANK_PATH' }
    | { type: 'CONFIRM_DELETE' }
    | { type: 'CANCEL_DELETE' }
    | { type: 'DELETE_COMPLETE' }
    | { type: 'SHOW_CONTEXT_MENU' }
    | { type: 'HIDE_CONTEXT_MENU' }
    | { type: 'TOGGLE_IGNORE' }
    | { type: 'SHOW_IGNORE_DIALOG' }
    | { type: 'HIDE_IGNORE_DIALOG' }
    | { type: 'ADD_IGNORE_PATTERN'; pattern: string }
    | { type: 'REMOVE_IGNORE_PATTERN'; pattern: string }
    | { type: 'UPDATE_IGNORE_PATTERN'; oldPattern: string; newPattern: string }
    | { type: 'ADD_GLOBAL_IGNORE_PATTERN'; pattern: string }
    | { type: 'REMOVE_GLOBAL_IGNORE_PATTERN'; pattern: string }
    | {
          type: 'UPDATE_GLOBAL_IGNORE_PATTERN'
          oldPattern: string
          newPattern: string
      }
    | { type: 'SET_IGNORE_PATTERNS'; global: string[]; pair: string[] }
    | { type: 'SHOW_HELP' }
    | { type: 'HIDE_HELP' }
    | { type: 'SHOW_DIFF_VIEW'; entryIndex: number }
    | { type: 'HIDE_DIFF_VIEW' }
    | { type: 'SHOW_KEYBINDINGS_EDITOR' }
    | { type: 'HIDE_KEYBINDINGS_EDITOR' }
    | { type: 'KEYBINDINGS_UPDATED' }

export interface AppState {
    focusedPanel: PanelSide
    expandedDirs: Set<string>
    cursorIndex: number
    scrollOffset: number
    leftScan: ScanResult | null
    rightScan: ScanResult | null
    error: string | null
    entries: CompareEntry[]
    dialog: DialogType | null
    config: import('~/utils/config').AppConfig
    swapped: boolean
    filterMode: FilterMode
    ignoreEnabled: boolean
    globalIgnorePatterns: string[]
    pairIgnorePatterns: string[]
    diffViewEntryIndex: number | null
    keybindingVersion: number
}
