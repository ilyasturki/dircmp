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
}

export const keymap: Shortcut[] = [
    // Global
    {
        mode: 'global',
        keyLabel: '',
        description: 'quit',
        match: (input) => input === 'q',
        effect: { type: 'exit' },
    },

    // Browser mode
    {
        mode: 'browser',
        keyLabel: '',
        description: 'navigate',
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
        match: (input, key) => key.downArrow || (input === 'j' && !key.shift),
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'down' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'top/bottom',
        match: (input) => input === 'G',
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'bottom' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'top',
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
        match: (_input, key) => key.tab,
        effect: { type: 'dispatch', action: { type: 'SWITCH_PANEL' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'expand/collapse',
        match: (input, key) => input === 'l' || key.rightArrow,
        effect: { type: 'dispatch', action: { type: 'NAVIGATE_INTO' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'open',
        match: (_input, key) => key.return,
        effect: { type: 'dispatch', action: { type: 'OPEN_DIFF' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'collapse',
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
        sequence: 'zR',
        match: () => false,
        effect: { type: 'dispatch', action: { type: 'EXPAND_ALL' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'collapse all',
        sequence: 'zM',
        match: () => false,
        effect: { type: 'dispatch', action: { type: 'COLLAPSE_ALL' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'half page',
        match: () => false, // handled directly in useKeymap before keymap matching
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'down' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'full page',
        match: () => false, // handled directly in useKeymap before keymap matching
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'down' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'next/prev diff',
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
        match: (input) => input === 'y',
        effect: { type: 'dispatch', action: { type: 'YANK_PATH' } },
    },
    {
        mode: 'browser',
        keyLabel: '.',
        description: 'actions',
        match: (input) => input === '.',
        effect: { type: 'dispatch', action: { type: 'SHOW_CONTEXT_MENU' } },
    },
    {
        mode: 'browser',
        keyLabel: ',',
        description: 'preferences',
        match: (input) => input === ',',
        effect: { type: 'dispatch', action: { type: 'TOGGLE_PREFERENCES' } },
    },
    {
        mode: 'browser',
        keyLabel: 'f',
        description: 'diff only',
        match: (input) => input === 'f',
        effect: { type: 'dispatch', action: { type: 'TOGGLE_FILTER' } },
    },
    {
        mode: 'browser',
        keyLabel: '>/<',
        description: 'copy right/left',
        match: (input) => input === '>',
        effect: { type: 'dispatch', action: { type: 'COPY_TO_RIGHT' } },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'copy left',
        match: (input) => input === '<',
        effect: { type: 'dispatch', action: { type: 'COPY_TO_LEFT' } },
    },
    {
        mode: 'browser',
        keyLabel: 'd',
        description: 'delete',
        match: (input) => input === 'd',
        effect: { type: 'dispatch', action: { type: 'CONFIRM_DELETE' } },
    },
    {
        mode: 'browser',
        keyLabel: 'r',
        description: 'refresh',
        match: (input) => input === 'r',
        effect: { type: 'dispatch', action: { type: 'REFRESH' } },
    },
    {
        mode: 'browser',
        keyLabel: 'S',
        description: 'swap panels',
        match: (input) => input === 'S',
        effect: { type: 'dispatch', action: { type: 'SWAP_PANELS' } },
    },
]
