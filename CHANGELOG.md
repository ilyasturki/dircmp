# Changelog

## [1.3.0]

### Added

- Split side-by-side file diff view with switchable side focus
- Inline word-level diff for paired `-`/`+` lines
- Copy a focused hunk across sides with `>`/`<`, or push with `Space`
- Line-by-line selection mode in the file diff view (`a` to toggle)
- Undo/redo for copy, delete, and pair actions in the directory view
- Hunk-level undo/redo scoped to the edited file in the file diff view
- Open focused entry in `$EDITOR` with `e`
- Adjust diff context size with `{` and `}`
- Scroll line-by-line with `Ctrl+e` / `Ctrl+y`
- Honor `XDG_CONFIG_HOME` and `XDG_DATA_HOME` for config, ignore, and data files
- Navigate per change block instead of full hunks
- Skipped line count in hunk header banner
- Full left and right paths in the file diff header
- Keyboard hints at the bottom of the diff view (respects `showHints`)
- `r` refresh also works in the file diff view

### Changed

- **Breaking:** require Node.js ≥22 (upgrades Ink to 7 and `diff` to 9)
- Vim-style `u` / `U` for undo/redo, and `M` to unpair directories

### Fixed

- Re-init trash session when `XDG_CACHE_HOME` changes between calls
- Keep context lines visible when auto-scrolling to a hunk
- Keep line-mode active during reload after a copy
- Keep directory view viewport stable when the cursor moves within it
- Size the keybindings dialog width to fit the longest description and key
- Prevent text-input cursor desync during rapid typing

### Performance

- Defer directory diff count and cache descendants for faster status bar

## [1.2.0]

### Added

- Direct file-to-file comparison via CLI args (works in TUI, `diff`, and `check` subcommands)
- Status bar shows file size, relative path, and colored `+N -M` line diff stats for the focused entry
- `[m]` indicator next to directories marked for pairing
- Cancel a pending pair mark by pressing `m` again, `u`, or `Escape`

### Changed

- Delete confirmation dialog now uses selectable confirm/cancel options instead of inline key hints

## [1.1.0]

### Added

- Sort options dialog with name, size, date modified, and status sort modes
- Directories-first toggle in sort options
- Content-based file comparison via SHA-256 hashing
- Manual directory pairing for renamed directories
- Nerd Font config option with ASCII fallback for non-nerd-font terminals
- Hint text for compare contents preference

### Fixed

- Remove os-theme dependency that froze TUI in release builds
- Show broken-link icon for broken symlinks
- Correct ignore pattern matching for directory paths
- Preserve cursor position across ignore pattern changes
- Improve light mode contrast for dimmed selections
- Unify directory icon color with row highlight on selection
- Allow opening identical files in diff view
- Deduplicate entry keys and disambiguate files from directories
- Default `compareDates` option to false
- Fix Homebrew binary permissions for shell completions

### Performance

- Memoize entry row components and lift panel width to reduce re-renders

## [1.0.3]

## [1.0.2]

### Added

- MIT license file
- AUR packages (`dircmp` and `dircmp-bin`)
- Cross-compiled release binaries for linux-arm64, darwin, and windows

## [1.0.1]

### Added

- In-app release notes dialog with scrollable changelog viewer

## [1.0.0]

### Added

- Remote directory comparison via rclone-based FUSE mounting
- Show modification dates for date-only differences in status bar
- `/` shortcut to search and filter keybindings in help dialog
- npm publishing support with scoped package name and provenance

### Fixed

- Preserve bun compiled binary in Nix builds by disabling strip and patchelf
- Detect FUSE mount via device ID instead of directory listing

### Performance

- Pre-scan remote directories via rclone lsjson concurrently with FUSE mount

## [0.4.1]

### Changed

- Nix package now builds a standalone binary instead of using a bun wrapper

## [0.4.0]

### Added

- Shell completions subcommand for bash, zsh, and fish
- Vim-style motions (`gg`, `Ctrl+D/U/F/B`) in keybindings editor
- Scroll arrows in keybindings editor dialog

### Fixed

- Truncate keyboard hint line to fit terminal width

## [0.3.0]

### Added

- Filter entries by name with `/` key and live highlighted results
- `compareDates` config option to toggle date-based file comparison
- Hint text in preference input fields
- Modified marker and `d`-to-reset shortcut in preferences dialog

### Changed

- Adapt unfocused selection background to terminal color scheme

## [0.2.0]

### Added

- `diff` and `check` CLI subcommands with ignore flags
- Built-in unified diff viewer with line-level added/removed counts
- Configurable external diff command via `diffCommand` config option
- User-customizable keybindings via `~/.config/dircmp/keybindings.json`
- In-app keybindings editor dialog with edit and reset
- Quick-ignore dialog on `i` key

### Fixed

- Consistent editable format and input validation in keybindings

## [0.1.1]

### Changed

- Inverse highlight for focused entries in ignore dialog
- Interactive empty state in ignore dialog

## [0.1.0]

### Added

- Help dialog listing all keybindings on `?` press
- Use alternate screen buffer to clear UI on exit
- `showHints` preference to toggle status bar keyboard hints

### Fixed

- Clear timers on unmount to prevent exit hang

## [0.0.4]

### Added

- Two-row status bar showing focused entry diff info and scan duration toast
- File and directory sizes in entry rows
- Per-directory-pair ignore patterns instead of global
- Editable global patterns in ignore dialog
- Gitignore syntax hints in ignore dialog
- Replace home directory with `~` in panel titles

### Fixed

- Preserve cursor position across refresh
- Allow navigation between ignore dialog sections when one is empty
- Show "date modified" when file content is identical
- Remove terminal minimum size check

### Performance

- Replace file hashing with size+mtime comparison and parallelize stat calls

## [0.0.3]

### Fixed

- Stage flake.nix in version hook instead of postversion

## [0.0.2]

### Added

- Ignore pattern filtering with toggle
- Interactive ignore dialog with browse, edit, and delete modes
- `--help` and `--version` CLI flags
- Show relative path in context menu title

## [0.0.1]

### Added

- Side-by-side directory comparison TUI
- Tree view with expand/collapse and expand all/collapse all
- Vim keybindings (j/k/h/l, G/gg, Ctrl+D/U, Ctrl+F/B)
- Open files in `nvim -d` for diffing
- Color-coded diff status (modified, new, missing)
- Nerd Font file type icons
- Diff-only filter mode
- Copy entries between directories
- Delete entries with confirmation
- Yank file path to clipboard
- Jump between diffs with `]c`/`[c`
- Context menu with quick actions
- Preferences dialog with date locale setting
- NixOS packaging via flake.nix
