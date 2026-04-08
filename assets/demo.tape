# dircmp — README hero demo
# Usage: vhs demo.tape

Output assets/demo.gif
Set FontSize 16
Set FontFamily "IosevkaTerm Nerd Font Mono"
Set Width 1200
Set Height 700
Set Padding 20
Set Framerate 50
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set Shell bash

Type "DIRCMP_RECORDING=1 ./dircmp ./data/left ./data/right"
Enter
Sleep 3s

# Navigate down through the tree (vim keys for TUI compatibility)
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms

# Expand a directory
Type "l"
Sleep 500ms

# Navigate into children
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms

# Open diff view on a modified file
Enter
Sleep 2s

# Scroll down in diff view
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms

# Exit diff view
Escape
Sleep 500ms

# Switch to right panel
Tab
Sleep 500ms

# Navigate a bit on the right panel
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms
Type "k"
Sleep 300ms

# Toggle diff-only filter
Type "f"
Sleep 1.5s

# Toggle it back
Type "f"
Sleep 1s

# Quit
Type "q"
Sleep 500ms
