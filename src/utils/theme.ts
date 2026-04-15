import type { TextProps } from 'ink'

type Color = TextProps['color']

export const theme = {
    // Borders / panels
    borderFocused: 'cyan',
    borderUnfocused: 'gray',

    // Selection / interactive accents (all cyan today, separate keys)
    selectionMarker: 'cyan',
    keybindingKey: 'cyan',
    searchPrefix: 'cyan',
    statusBarMode: 'cyan',
    versionHeader: 'cyan',

    // Search match highlight
    searchMatchBg: 'cyan',
    searchMatchFg: 'black',

    // Dim / structural
    dimText: 'gray',
    dimSelectedBg: 'blackBright',

    // Entry status (panel rows)
    entryModified: 'yellow',
    entryOnlyLeft: 'green',
    entryOnlyRight: 'green',
    entrySymlink: 'cyan',
    entryPaired: 'magenta',
    entryPairMark: 'magenta',

    // Errors / warnings / loading
    errorText: 'red',
    warning: 'yellow',
    loading: 'yellow',

    // Diff coloring
    diffAddedLine: 'green',
    diffRemovedLine: 'yellow',
    diffChangedSegment: 'red',
    diffAddedCount: 'green',
    diffRemovedCount: 'red',
    diffGutterFocused: 'cyan',

    // Dialog buttons
    buttonConfirm: 'green',
    buttonCancel: 'yellow',
} as const satisfies Record<string, Color>

export const borderFor = (focused: boolean): Color =>
    focused ? theme.borderFocused : theme.borderUnfocused

const nameToAnsi: Record<string, string> = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    blackBright: '\x1b[90m',
    black: '\x1b[30m',
    white: '\x1b[37m',
}

export const ansiReset = '\x1b[0m'
export const ansiDim = '\x1b[2m'
export const ansiBold = '\x1b[1m'

export const ansiFor = (key: keyof typeof theme): string => {
    const v = theme[key]
    return (typeof v === 'string' && nameToAnsi[v]) || ''
}
