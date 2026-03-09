export interface FileEntry {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: Date;
  contentHash: string | null;
  error?: string;
}

export type DiffStatus = 'identical' | 'modified' | 'only-left' | 'only-right';

export interface CompareEntry {
  relativePath: string;
  name: string;
  isDirectory: boolean;
  status: DiffStatus;
  left?: FileEntry;
  right?: FileEntry;
  depth: number;
  isExpanded: boolean;
}

export type ScanResult = Map<string, FileEntry>;

export type ViewMode = 'browser' | 'diff';
export type PanelSide = 'left' | 'right';

export interface DiffResult {
  isBinary: boolean;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
}

export type Action =
  | { type: 'SCAN_COMPLETE'; leftScan: ScanResult; rightScan: ScanResult }
  | { type: 'SCAN_ERROR'; error: string }
  | { type: 'MOVE_CURSOR'; direction: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'SWITCH_PANEL' }
  | { type: 'NAVIGATE_INTO' }
  | { type: 'COLLAPSE_PARENT' }
  | { type: 'CLOSE_DIFF' }
  | { type: 'DIFF_LOADED'; diffResult: DiffResult }
  | { type: 'SCROLL_DIFF'; direction: 'up' | 'down' }

export interface AppState {
  viewMode: ViewMode;
  focusedPanel: PanelSide;
  expandedDirs: Set<string>;
  cursorIndex: number;
  scrollOffset: number;
  leftScan: ScanResult | null;
  rightScan: ScanResult | null;
  selectedFile: string | null;
  diffResult: DiffResult | null;
  diffScrollOffset: number;
  error: string | null;
  entries: CompareEntry[];
}
