import type { Key } from 'ink'

import type { Action } from '~/utils/types'

type KeyMatcher = (input: string, key: Key) => boolean

type ShortcutEffect = { type: 'dispatch'; action: Action } | { type: 'exit' }

export interface Shortcut {
    mode: 'browser' | 'global'
    keyLabel: string
    description: string
    match: KeyMatcher
    effect: ShortcutEffect
    sequence?: string
    helpKey?: string
}

export interface HelpItem {
    key: string
    description: string
    effect: ShortcutEffect
}

export function getHelpItems(): HelpItem[] {
    return keymap
        .filter((s) => s.helpKey !== undefined)
        .map((s) => ({
            key: s.helpKey!,
            description: s.description,
            effect: s.effect,
        }))
}

export const keymap: Shortcut[] = [
    // Global
    {
        mode: 'global',
        keyLabel: '',
        description: 'quit',
        helpKey: 'q',
        match: (input) => input === 'q',
        effect: { type: 'exit' },
    },

    // Browser mode
    {
        mode: 'browser',
        keyLabel: '',
        description: 'navigate',
        helpKey: 'k/↑',
        match: (input, key) => key.upArrow || input === 'k',
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'up' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'navigate',
        helpKey: 'j/↓',
        match: (input, key) => key.downArrow || (input === 'j' && !key.shift),
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'down' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'go to bottom',
        helpKey: 'G',
        match: (input) => input === 'G',
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'bottom' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'go to top',
        helpKey: 'gg',
        sequence: 'gg',
        match: () => false, // handled by sequence logic in useKeymap
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'top' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'focus left panel',
        helpKey: 'H',
        match: (input) => input === 'H',
        effect: {
            type: 'dispatch',
            action: { type: 'FOCUS_PANEL', panel: 'left' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'focus right panel',
        helpKey: 'L',
        match: (input) => input === 'L',
        effect: {
            type: 'dispatch',
            action: { type: 'FOCUS_PANEL', panel: 'right' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'switch panel',
        helpKey: 'Tab',
        match: (_input, key) => key.tab,
        effect: { type: 'dispatch', action: { type: 'SWITCH_PANEL' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'expand/collapse',
        helpKey: 'l/→',
        match: (input, key) => input === 'l' || key.rightArrow,
        effect: { type: 'dispatch', action: { type: 'NAVIGATE_INTO' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'open diff',
        helpKey: 'Enter',
        match: (_input, key) => key.return,
        effect: { type: 'dispatch', action: { type: 'OPEN_DIFF' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'collapse',
        helpKey: 'h/←',
        match: (input, key) =>
            key.backspace
            || key.delete
            || (input === 'h' && !key.shift)
            || key.leftArrow,
        effect: { type: 'dispatch', action: { type: 'COLLAPSE_PARENT' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'expand all',
        helpKey: 'zR',
        sequence: 'zR',
        match: () => false,
        effect: { type: 'dispatch', action: { type: 'EXPAND_ALL' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'collapse all',
        helpKey: 'zM',
        sequence: 'zM',
        match: () => false,
        effect: { type: 'dispatch', action: { type: 'COLLAPSE_ALL' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'half page scroll',
        helpKey: 'Ctrl+d/u',
        match: () => false, // handled directly in useKeymap before keymap matching
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'down' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'full page scroll',
        helpKey: 'Ctrl+f/b',
        match: () => false, // handled directly in useKeymap before keymap matching
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'down' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'next diff',
        helpKey: ']c',
        sequence: ']c',
        match: () => false,
        effect: {
            type: 'dispatch',
            action: { type: 'JUMP_TO_DIFF', direction: 'next' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'prev diff',
        helpKey: '[c',
        sequence: '[c',
        match: () => false,
        effect: {
            type: 'dispatch',
            action: { type: 'JUMP_TO_DIFF', direction: 'prev' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'yank path',
        helpKey: 'y',
        match: (input) => input === 'y',
        effect: { type: 'dispatch', action: { type: 'YANK_PATH' } },
    },
    {
        mode: 'browser',
        keyLabel: '.',
        description: 'actions',
        helpKey: '.',
        match: (input) => input === '.',
        effect: { type: 'dispatch', action: { type: 'SHOW_CONTEXT_MENU' } },
    },
    {
        mode: 'browser',
        keyLabel: ',',
        description: 'preferences',
        helpKey: ',',
        match: (input) => input === ',',
        effect: { type: 'dispatch', action: { type: 'TOGGLE_PREFERENCES' } },
    },
    {
        mode: 'browser',
        keyLabel: 'f',
        description: 'diff only',
        helpKey: 'f',
        match: (input) => input === 'f',
        effect: { type: 'dispatch', action: { type: 'TOGGLE_FILTER' } },
    },
    {
        mode: 'browser',
        keyLabel: 'i',
        description: 'ignore',
        helpKey: 'i',
        match: (input, key) => input === 'i' && !key.shift,
        effect: { type: 'dispatch', action: { type: 'TOGGLE_IGNORE' } },
    },
    {
        mode: 'browser',
        keyLabel: 'I',
        description: 'ignore patterns',
        helpKey: 'I',
        match: (input) => input === 'I',
        effect: { type: 'dispatch', action: { type: 'SHOW_IGNORE_DIALOG' } },
    },
    {
        mode: 'browser',
        keyLabel: '>/<',
        description: 'copy to right',
        helpKey: '>',
        match: (input) => input === '>',
        effect: { type: 'dispatch', action: { type: 'COPY_TO_RIGHT' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'copy to left',
        helpKey: '<',
        match: (input) => input === '<',
        effect: { type: 'dispatch', action: { type: 'COPY_TO_LEFT' } },
    },
    {
        mode: 'browser',
        keyLabel: 'd',
        description: 'delete',
        helpKey: 'd',
        match: (input) => input === 'd',
        effect: { type: 'dispatch', action: { type: 'CONFIRM_DELETE' } },
    },
    {
        mode: 'browser',
        keyLabel: 'r',
        description: 'refresh',
        helpKey: 'r',
        match: (input) => input === 'r',
        effect: { type: 'dispatch', action: { type: 'REFRESH' } },
    },
    {
        mode: 'browser',
        keyLabel: 'S',
        description: 'swap panels',
        helpKey: 'S',
        match: (input) => input === 'S',
        effect: { type: 'dispatch', action: { type: 'SWAP_PANELS' } },
    },
    {
        mode: 'browser',
        keyLabel: '?',
        description: 'keybindings',
        helpKey: '?',
        match: (input) => input === '?',
        effect: { type: 'dispatch', action: { type: 'SHOW_HELP' } },
    },
]
