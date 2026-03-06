import { Box, Text } from 'ink';
import type { ViewMode } from '~/utils/types';
import type { Shortcut } from '~/keymap';

interface StatusBarProps {
  viewMode: ViewMode;
  isLoading: boolean;
  keymap: Shortcut[];
}

export function StatusBar({ viewMode, isLoading, keymap }: StatusBarProps) {
  if (isLoading) {
    return (
      <Box>
        <Text color="yellow">Scanning directories...</Text>
      </Box>
    );
  }

  const helpText = keymap
    .filter((s) => (s.mode === 'global' || s.mode === viewMode) && s.keyLabel !== '')
    .map((s) => `${s.keyLabel}: ${s.description}`)
    .join(' | ');

  return (
    <Box>
      <Text dimColor>{helpText}</Text>
    </Box>
  );
}
