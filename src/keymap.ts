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
        match: (_input, key) => key.upArrow || _input === 'k',
        effect: {
            type: 'dispatch',
            action: { type: 'MOVE_CURSOR', direction: 'up' },
        },
    },
    {
        mode: 'browser',
        keyLabel: '',
        description: 'navigate',
        match: (_input, key) => key.downArrow || _input === 'j',
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
        description: 'focus left/right panel',
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
        match: (input) => input === 'J',
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
        description: 'open',
        match: (_input, key) => key.return || _input === 'l',
        effect: { type: 'dispatch', action: { type: 'NAVIGATE_INTO' } },
    },
    {
        mode: 'browser',
        keyLabel: 'h',
        description: 'collapse',
        match: (_input, key) => key.backspace || key.delete || _input === 'h',
        effect: { type: 'dispatch', action: { type: 'COLLAPSE_PARENT' } },
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
