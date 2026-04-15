# dircmp — GitHub social preview screenshot
# Usage: vhs assets/social-preview.tape
# Produces a 2:1 PNG suitable for GitHub's Social preview setting.

Output assets/social-preview.gif
Set FontSize 28
Set FontFamily "IosevkaTerm Nerd Font"
Set Width 2560
Set Height 1280
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

# Move a few rows down and expand src/ so the tree shows real content
Type "jjjjjjjj"
Sleep 400ms
Type "l"
Sleep 400ms
Type "jl"
Sleep 500ms

Screenshot assets/social-preview.png
