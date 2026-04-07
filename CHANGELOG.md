# Changelog

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
