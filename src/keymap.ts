import type { Key } from 'ink';
import type { Action, ViewMode } from '~/utils/types';

type KeyMatcher = (input: string, key: Key) => boolean;

type ShortcutEffect =
  | { type: 'dispatch'; action: Action }
  | { type: 'exit' };

export interface Shortcut {
  mode: ViewMode | 'global';
  keyLabel: string;
  description: string;
  match: KeyMatcher;
  effect: ShortcutEffect;
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

  // Diff mode
  {
    mode: 'diff',
    keyLabel: 'Up/Down',
    description: 'scroll',
    match: (_input, key) => key.upArrow,
    effect: { type: 'dispatch', action: { type: 'SCROLL_DIFF', direction: 'up' } },
  },
  {
    mode: 'diff',
    keyLabel: '',
    description: 'scroll',
    match: (_input, key) => key.downArrow,
    effect: { type: 'dispatch', action: { type: 'SCROLL_DIFF', direction: 'down' } },
  },
  {
    mode: 'diff',
    keyLabel: 'Esc',
    description: 'back',
    match: (_input, key) => key.escape,
    effect: { type: 'dispatch', action: { type: 'CLOSE_DIFF' } },
  },

  // Browser mode
  {
    mode: 'browser',
    keyLabel: 'Up/Down',
    description: 'navigate',
    match: (_input, key) => key.upArrow,
    effect: { type: 'dispatch', action: { type: 'MOVE_CURSOR', direction: 'up' } },
  },
  {
    mode: 'browser',
    keyLabel: '',
    description: 'navigate',
    match: (_input, key) => key.downArrow,
    effect: { type: 'dispatch', action: { type: 'MOVE_CURSOR', direction: 'down' } },
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
    keyLabel: 'Enter',
    description: 'open',
    match: (_input, key) => key.return,
    effect: { type: 'dispatch', action: { type: 'NAVIGATE_INTO' } },
  },
  {
    mode: 'browser',
    keyLabel: 'Backspace',
    description: 'go up',
    match: (_input, key) => key.backspace || key.delete,
    effect: { type: 'dispatch', action: { type: 'NAVIGATE_UP' } },
  },
];
