# Changelog

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
