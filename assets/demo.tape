# dircmp — README hero demo
# Usage: vhs assets/demo.tape

Output assets/demo.gif
Set FontSize 28
Set FontFamily "IosevkaTerm Nerd Font"
Set Width 2400
Set Height 1400
Set Padding 40
Set Framerate 30
Set Theme { "name": "Adwaita Dark", "background": "#1d1d20", "foreground": "#ffffff", "cursor": "#ffffff", "selection": "#ffffff", "black": "#241f31", "red": "#c01c28", "green": "#2ec27e", "yellow": "#f5c211", "blue": "#1e78e4", "magenta": "#9841bb", "cyan": "#0ab9dc", "white": "#c0bfbc", "brightBlack": "#5e5c64", "brightRed": "#ed333b", "brightGreen": "#57e389", "brightYellow": "#f8e45c", "brightBlue": "#51a1ff", "brightMagenta": "#c061cb", "brightCyan": "#4fd2fd", "brightWhite": "#f6f5f4" }
Set TypingSpeed 50ms
Set Shell bash

Hide
Type "export DIRCMP_RECORDING=1"
Enter
Type "export XDG_CONFIG_HOME=./.dev/config"
Enter
Type "export XDG_DATA_HOME=./.dev/data"
Enter
Type "alias dircmp=./dircmp"
Enter
Type "rsync -a --delete ./data/left/ /tmp/demo-left/ && rsync -a --delete ./data/right/ /tmp/demo-right/"
Enter
Type "clear"
Enter
Show

Type "dircmp /tmp/demo-left /tmp/demo-right"
Enter
Sleep 2.5s

# Tour the top-level tree
Type "j"
Sleep 220ms
Type "j"
Sleep 220ms
Type "j"
Sleep 220ms
Type "j"
Sleep 400ms

# Continue down to src/ (extra step for the blank right-only row)
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 400ms

# Expand src/
Type "l"
Sleep 500ms

# Dive into src/components/
Type "j"
Sleep 250ms
Type "l"
Sleep 500ms

# Land on the modified App.tsx
Type "j"
Sleep 300ms

# Open the unified diff view
Enter
Sleep 1.8s

# Jump through changes (j = next hunk)
Type "j"
Sleep 350ms
Type "j"
Sleep 350ms
Type "j"
Sleep 500ms

# Push a hunk from focused side
Space
Sleep 700ms

# Switch to line-by-line selection mode
Type "a"
Sleep 500ms
Type "j"
Sleep 250ms
Type "j"
Sleep 250ms
Type "j"
Sleep 250ms
Type "j"
Sleep 250ms
Type "j"
Sleep 250ms
Type "j"
Sleep 500ms
# Push the focused line
Space
Sleep 700ms
# Back to change mode
Type "a"
Sleep 500ms

# Widen context lines by 3
Type "}"
Sleep 300ms
Type "}"
Sleep 300ms
Type "}"
Sleep 600ms

# Close diff view
Escape
Sleep 500ms

# Collapse back to top level
Type "h"
Sleep 250ms
Type "h"
Sleep 250ms
Type "h"
Sleep 500ms

# Switch focus to the right panel
Tab
Sleep 500ms

# Navigate a right-only directory
Type "j"
Sleep 220ms
Type "j"
Sleep 220ms
Type "j"
Sleep 500ms

# Swap the two panels (zs)
Type "zs"
Sleep 1.2s

# Swap back
Type "zs"
Sleep 800ms

# Manage ignore patterns
Type "I"
Sleep 2s
Escape
Sleep 500ms

# Open preferences
Type ","
Sleep 2s
Escape
Sleep 500ms

# Open the full keybindings help
Type "?"
Sleep 2.8s
Escape
Sleep 500ms

# Quit
Type "q"
Sleep 500ms
