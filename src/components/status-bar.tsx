import { Box, Text } from 'ink';
import type { ViewMode } from '~/utils/types';

interface StatusBarProps {
  viewMode: ViewMode;
  isLoading: boolean;
}

export function StatusBar({ viewMode, isLoading }: StatusBarProps) {
  if (isLoading) {
    return (
      <Box>
        <Text color="yellow">Scanning directories...</Text>
      </Box>
    );
  }

  if (viewMode === 'diff') {
    return (
      <Box>
        <Text dimColor>
          Up/Down: scroll | Esc: back | q: quit
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text dimColor>
        Up/Down: navigate | Tab: switch panel | Enter: open | Backspace: go up | q: quit
      </Text>
    </Box>
  );
}
