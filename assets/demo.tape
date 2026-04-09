# dircmp — README hero demo
# Usage: vhs assets/demo.tape

Output assets/demo.gif
Set FontSize 28
Set FontFamily "IosevkaTerm Nerd Font Mono"
Set Width 2400
Set Height 1400
Set Padding 40
Set Framerate 30
Set Theme "GitHub Dark"
Set TypingSpeed 50ms
Set Shell bash

Hide
Type "export DIRCMP_RECORDING=1"
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
Sleep 2s

# Browse the tree
Type "j"
Sleep 200ms
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
Sleep 400ms

# Navigate into src children
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 400ms

# Expand src/components/
Type "l"
Sleep 400ms

Type "j"
Sleep 200ms
Type "j"
Sleep 400ms

# Open diff view on a modified file
Enter
Sleep 1.5s

# Scroll through the diff
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 800ms

# Exit diff view
Escape
Sleep 400ms

# Collapse back up
Type "h"
Sleep 300ms
Type "h"
Sleep 400ms

# Switch to right panel
Tab
Sleep 400ms

# Navigate on right panel
Type "j"
Sleep 200ms
Type "j"
Sleep 200ms
Type "j"
Sleep 400ms

# Swap panels
Shift+S
Sleep 1s

# Swap back
Shift+S
Sleep 800ms

# Show help
Type "?"
Sleep 2s

# Close help
Escape
Sleep 500ms

# Quit
Type "q"
Sleep 500ms
