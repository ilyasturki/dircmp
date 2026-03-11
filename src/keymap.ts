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
        keyLabel: 'q',
        description: 'quit',
        match: (input) => input === 'q',
        effect: { type: 'exit' },
    },

    // Browser mode
    {
        mode: 'browser',
        keyLabel: 'j/k',
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
        keyLabel: 'G/gg',
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
        keyLabel: 'H/J',
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
        keyLabel: 'Tab',
        description: 'switch panel',
        match: (_input, key) => key.tab,
        effect: { type: 'dispatch', action: { type: 'SWITCH_PANEL' } },
    },
    {
        mode: 'browser',
        keyLabel: 'l',
        description: 'expand/collapse',
        match: (input, key) => input === 'l' || key.rightArrow,
        effect: { type: 'dispatch', action: { type: 'NAVIGATE_INTO' } },
    },
    {
        mode: 'browser',
        keyLabel: 'Enter',
        description: 'open',
        match: (_input, key) => key.return,
        effect: { type: 'dispatch', action: { type: 'OPEN_DIFF' } },
    },
    {
        mode: 'browser',
        keyLabel: 'h',
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
        keyLabel: 'zR',
        description: 'expand all',
        sequence: 'zR',
        match: () => false,
        effect: { type: 'dispatch', action: { type: 'EXPAND_ALL' } },
    },
    {
        mode: 'browser',
        keyLabel: 'zM',
        description: 'collapse all',
        sequence: 'zM',
        match: () => false,
        effect: { type: 'dispatch', action: { type: 'COLLAPSE_ALL' } },
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
        keyLabel: 'r',
        description: 'refresh',
        match: (input) => input === 'r',
        effect: { type: 'dispatch', action: { type: 'REFRESH' } },
    },
    {
        mode: 'browser',
        keyLabel: 's',
        description: 'swap panels',
        match: (input) => input === 's',
        effect: { type: 'dispatch', action: { type: 'SWAP_PANELS' } },
    },
]
