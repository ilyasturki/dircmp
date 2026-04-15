# dircmp

Terminal TUI for comparing two directories side by side.

![dircmp screenshot](assets/screenshot.png)

[![npm version](https://img.shields.io/npm/v/@ilyasturki/dircmp)](https://www.npmjs.com/package/@ilyasturki/dircmp)
[![CI](https://github.com/ilyasturki/dircmp/actions/workflows/ci.yml/badge.svg)](https://github.com/ilyasturki/dircmp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/ilyasturki/dircmp)](LICENSE)
[![AUR version](https://img.shields.io/aur/version/dircmp)](https://aur.archlinux.org/packages/dircmp)
[![platform](https://img.shields.io/badge/platform-linux%20%7C%20macOS%20%7C%20windows-blue)](https://github.com/ilyasturki/dircmp/releases)

## Features

- **Side-by-side tree view** with color-coded diff status
- **Built-in unified diff viewer** with line-level added/removed counts
- **Copy, delete, and sync** entries between directories
- **Gitignore-style ignore patterns** (global and per-directory-pair)
- **Remote directory support** via rclone (SFTP, S3, GCS)
- **Manual directory pairing** for renamed directories
- **Content-based comparison** via SHA-256 hashing
- **Sortable entries** by name, size, date modified, or status
- **Configurable** preferences, keybindings, and external diff command

## Installation

### npx (no install)

```sh
npx @ilyasturki/dircmp <left-dir> <right-dir>
```

### npm

```sh
npm install -g @ilyasturki/dircmp
```

### Homebrew

```sh
brew install ilyasturki/dircmp/dircmp
```

### Arch Linux (AUR)

```sh
yay -S dircmp
```

### Nix

```sh
nix run github:ilyasturki/dircmp -- <left-dir> <right-dir>
```

Or add to your flake inputs and install the package:

```nix
{
  inputs.dircmp.url = "github:ilyasturki/dircmp";
}
```

Then add it to your installed packages:

```nix
environment.systemPackages = [
  inputs.dircmp.packages.${pkgs.system}.default
];
```

### Build from source

```sh
git clone https://github.com/ilyasturki/dircmp.git
cd dircmp
bun install
bun run build
./dircmp <left-dir> <right-dir>
```

## Comparison with other tools

| Tool                  | Terminal | Interactive | Recursive tree | In-place copy/delete/sync | Remote dirs | Content hashing |
| --------------------- | :------: | :---------: | :------------: | :-----------------------: | :---------: | :-------------: |
| `diff -qr`            |    ✓     |      ✗      |       ✓        |             ✗             |      ✗      |        ✗        |
| `rsync -nai`          |    ✓     |      ✗      |       ✓        |        ✗ (re-run)         |      ✓      |    checksum     |
| `git diff --no-index` |    ✓     |      ✗      |       ✓        |             ✗             |      ✗      |        ✗        |
| `vimdiff` / `nvim -d` |    ✓     |      ✓      | ✗ (file-only)  |          manual           |      ✗      |        ✗        |
| `diffoscope`          |    ✓     |      ✗      |       ✓        |             ✗             |      ✗      |        ✓        |
| `meld`                | ✗ (GUI)  |      ✓      |       ✓        |             ✓             |      ✗      |        ✗        |
| Beyond Compare        | ✗ (GUI)  |      ✓      |       ✓        |             ✓             |      ✓      |        ✓        |
| **dircmp**            |    ✓     |      ✓      |       ✓        |             ✓             | ✓ (rclone)  |   ✓ (SHA-256)   |

**When to reach for dircmp:** you live in the terminal (SSH, tmux, no X forwarding) and want the interactive ergonomics of a GUI differ — tree navigation, per-hunk copy, undo/redo, rename pairing — without leaving the shell. It also scripts cleanly: `dircmp check` and `dircmp diff --format json` plug into CI and pipelines.

**When another tool fits better:**

- **`diff -qr` / `rsync -nai`** — you only need a one-shot report in a script; no interaction required.
- **`meld`** — you want 3-way merge or are already in a graphical session. dircmp is 2-way only.
- **Beyond Compare** — you need deep binary/format-aware comparison (images, archives, registry files) and a commercial license is acceptable.
- **`diffoscope`** — you're auditing reproducible builds and need recursive comparison inside archives, ELFs, PDFs, etc.
- **`vimdiff` / `delta`** — you're comparing two single files and already have the editor open. dircmp can delegate to these via the `diffCommand` preference.

## Usage

```sh
dircmp <left-dir> <right-dir>
dircmp <left-file> <right-file>    # direct file-to-file diff
```

### CLI subcommands

**`diff`** — print differences to stdout:

```sh
dircmp diff <left-dir> <right-dir>
dircmp diff <left-dir> <right-dir> --format json
dircmp diff <left-dir> <right-dir> --only modified
dircmp diff <left-dir> <right-dir> --stat
```

Formats: `tree` (default), `flat`, `json`. Filters: `modified`, `left-only`, `right-only`.

**`check`** — silent comparison for scripts and CI:

```sh
dircmp check <left-dir> <right-dir>        # exits 0 if identical, 1 if different
dircmp check <left-dir> <right-dir> --stat  # print summary before exiting
```

### Remote directories

Requires [rclone](https://rclone.org). Supports SFTP, S3, GCS, and named rclone remotes:

```sh
dircmp ./local-dir sftp://user@host/path
dircmp ./local-dir s3://bucket/prefix
dircmp ./local-dir gcs://bucket/prefix
dircmp ./local-dir myremote:path
```

### Flags

| Flag                 | Description                              |
| -------------------- | ---------------------------------------- |
| `--no-ignore`        | Don't apply ignore patterns              |
| `--ignore <pattern>` | Add a custom ignore pattern (repeatable) |
| `--follow-symlinks`  | Follow symbolic links as their targets   |
| `--help`, `-h`       | Show help                                |
| `--version`, `-v`    | Show version                             |

## Keybindings

All keybindings are customizable via `~/.config/dircmp/keybindings.json` or the in-app editor (`K`). Press `?` in the app to see the live list grouped by mode.

### Universal

Works everywhere.

| Key         | Action                  |
| ----------- | ----------------------- |
| `Tab` / `%` | Switch panel focus      |
| `H` / `L`   | Focus left / right side |
| `r`         | Refresh comparison      |
| `u` / `U`   | Undo / redo             |
| `,`         | Open preferences        |
| `K`         | Open keybindings editor |
| `?`         | Show all keybindings    |
| `n`         | Show release notes      |

### Directory view

**Navigation**

| Key            | Action                 |
| -------------- | ---------------------- |
| `j` / `↓`      | Move cursor down       |
| `k` / `↑`      | Move cursor up         |
| `G` / `gg`     | Jump to last / first   |
| `Ctrl+d` / `u` | Half page down / up    |
| `Ctrl+f` / `b` | Full page down / up    |
| `Ctrl+e` / `y` | Scroll view down / up  |
| `zz`           | Center cursor in view  |
| `zt` / `zb`    | Cursor to top / bottom |

**Tree**

| Key       | Action                             |
| --------- | ---------------------------------- |
| `l` / `→` | Expand directory or enter file     |
| `h` / `←` | Collapse directory or go to parent |
| `Enter`   | Open unified diff view             |
| `zR`      | Expand all directories             |
| `zM`      | Collapse all directories           |
| `]c`      | Jump to next difference            |
| `[c`      | Jump to previous difference        |

**Actions**

| Key     | Action                          |
| ------- | ------------------------------- |
| `>`     | Copy entry to right             |
| `<`     | Copy entry to left              |
| `Space` | Copy entry from focused side    |
| `d`     | Delete selected entry           |
| `y`     | Yank file path to clipboard     |
| `e`     | Open focused entry in `$EDITOR` |
| `m`     | Mark/pair renamed directory     |
| `M`     | Unpair directory                |
| `Esc`   | Clear pending pair mark         |

**Filter, sort & config**

| Key  | Action                    |
| ---- | ------------------------- |
| `/`  | Filter entries by name    |
| `f`  | Open filter menu          |
| `s`  | Open sort options         |
| `S`  | Reverse sort direction    |
| `zs` | Swap left / right panels  |
| `i`  | Quick-add entry to ignore |
| `I`  | Manage ignore patterns    |
| `zi` | Toggle ignore filtering   |
| `.`  | Open actions menu         |
| `q`  | Quit                      |

### File diff view

| Key            | Action                              |
| -------------- | ----------------------------------- |
| `j` / `↓`      | Next change (or line in line mode)  |
| `k` / `↑`      | Previous change (or line)           |
| `G` / `gg`     | Jump to last / first change         |
| `Ctrl+e` / `y` | Scroll view down / up               |
| `zz`           | Center focused change in view       |
| `zt` / `zb`    | Focused change to top / bottom      |
| `>`            | Copy focused hunk to right          |
| `<`            | Copy focused hunk to left           |
| `Space`        | Copy focused hunk from focused side |
| `}` / `{`      | Increase / decrease context lines   |
| `a`            | Toggle line-by-line selection mode  |
| `w`            | Toggle soft-wrap for long lines     |
| `q` / `Esc`    | Close file diff view                |

## Configuration

### Preferences

Stored in `$XDG_CONFIG_HOME/dircmp/config.json` (defaults to `~/.config/dircmp/config.json`):

```json
{
    "dateLocale": "en-US",
    "showHints": true,
    "compareDates": true,
    "compareContents": true,
    "nerdFont": true,
    "dirsFirst": true,
    "diffCommand": "nvim -d"
}
```

| Option            | Description                                      |
| ----------------- | ------------------------------------------------ |
| `dateLocale`      | Locale for date formatting                       |
| `showHints`       | Show keyboard hints in the status bar            |
| `compareDates`    | Include modification dates in file comparison    |
| `compareContents` | Hash file contents (SHA-256) to detect changes   |
| `nerdFont`        | Use Nerd Font icons (falls back to ASCII)        |
| `dirsFirst`       | List directories before files                    |
| `diffCommand`     | External diff command (e.g., `nvim -d`, `delta`) |

### Ignore patterns

Patterns use gitignore syntax and are stored under `$XDG_DATA_HOME/dircmp/` (defaults to `~/.local/share/dircmp/`):

- **Global:** `ignore`
- **Per directory pair:** `pairs/<hash>.ignore`

Default ignored: `.git`, `node_modules`, `.DS_Store`.

## Manual directory pairing

When a directory has been renamed on one side, it shows up as two unmatched entries (one left-only, one right-only) instead of being compared together. Manual pairing lets you tell dircmp that two differently-named directories are logically the same, so their contents are diffed against each other.

1. Navigate to the directory on one side and press `m` — a magenta `[m]` indicator appears next to the name.
2. Switch to the other panel (`Tab`) and navigate to the corresponding renamed directory.
3. Press `m` again — the pairing is created and the two directories are compared as one entry.

Both directories must share the same parent directory. To cancel a pending mark before pairing, press `m` on the marked directory, `M`, or `Escape`. To remove an existing pairing, press `M` on the paired entry or restart the app.

## Color coding

| Color    | Meaning                                   |
| -------- | ----------------------------------------- |
| Yellow   | Modified (content or metadata differs)    |
| Green    | Only exists on one side                   |
| Cyan     | Symlink                                   |
| Magenta  | Manually paired directory (or `[m]` mark) |
| Dim      | Identical                                 |
| Red icon | Broken symlink or unreadable entry        |

## License

[MIT](LICENSE)
