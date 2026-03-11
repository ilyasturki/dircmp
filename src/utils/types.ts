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

export type FilterMode = 'all' | 'diff-only'

export type Action =
    | { type: 'SCAN_COMPLETE'; leftScan: ScanResult; rightScan: ScanResult }
    | { type: 'SCAN_ERROR'; error: string }
    | { type: 'MOVE_CURSOR'; direction: 'up' | 'down' | 'top' | 'bottom' }
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

export interface AppState {
    focusedPanel: PanelSide
    expandedDirs: Set<string>
    cursorIndex: number
    scrollOffset: number
    leftScan: ScanResult | null
    rightScan: ScanResult | null
    error: string | null
    entries: CompareEntry[]
    showPreferences: boolean
    config: import('~/utils/config').AppConfig
    swapped: boolean
    filterMode: FilterMode
}
