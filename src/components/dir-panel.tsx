import React from 'react';
import { Box, Text } from 'ink';
import type { CompareEntry, PanelSide } from '../types.js';

interface DirPanelProps {
  rootPath: string;
  currentPath: string;
  entries: CompareEntry[];
  cursorIndex: number;
  isFocused: boolean;
  side: PanelSide;
  visibleHeight: number;
  scrollOffset: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '    -';
  if (bytes < 1024) return `${bytes}B`.padStart(5);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`.padStart(5);
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`.padStart(5);
}

function formatDate(date: Date): string {
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${m}-${d} ${h}:${min}`;
}

export function DirPanel({
  rootPath,
  currentPath,
  entries,
  cursorIndex,
  isFocused,
  side,
  visibleHeight,
  scrollOffset,
}: DirPanelProps) {
  const displayPath = currentPath === '' ? '/' : `/${currentPath}`;
  const visibleEntries = entries.slice(scrollOffset, scrollOffset + visibleHeight);

  return (
    <Box
      flexDirection="column"
      width="50%"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
    >
      <Box>
        <Text bold color={isFocused ? 'cyan' : undefined}>
          {rootPath}
          {displayPath}
        </Text>
      </Box>
      {entries.length === 0 ? (
        <Box>
          <Text dimColor>(empty)</Text>
        </Box>
      ) : (
        visibleEntries.map((entry, i) => {
          const absoluteIndex = scrollOffset + i;
          const isSelected = absoluteIndex === cursorIndex && isFocused;
          const isMissingSide =
            (side === 'left' && entry.status === 'only-right') ||
            (side === 'right' && entry.status === 'only-left');

          if (isMissingSide) {
            return (
              <Box key={entry.relativePath + '-' + side}>
                <Text dimColor inverse={isSelected}>
                  {'  (missing)'}
                </Text>
              </Box>
            );
          }

          const fileEntry = side === 'left' ? entry.left : entry.right;
          const hasError = fileEntry?.error;

          let color: string | undefined;
          let dimColor = false;
          if (hasError) {
            color = 'yellow';
          } else if (entry.status === 'identical') {
            dimColor = true;
          } else if (entry.status === 'modified') {
            color = 'red';
          } else {
            color = 'green';
          }

          const name = entry.isDirectory ? `${entry.name}/` : entry.name;
          const size = entry.isDirectory ? '  <DIR>' : formatSize(fileEntry?.size ?? 0);
          const date = fileEntry ? formatDate(fileEntry.modifiedTime) : '';

          return (
            <Box key={entry.relativePath + '-' + side}>
              <Text
                bold={entry.isDirectory}
                color={entry.isDirectory && !color ? 'blue' : color}
                dimColor={dimColor}
                inverse={isSelected}
              >
                {`${name.padEnd(24).slice(0, 24)} ${size} ${date}`}
                {hasError ? ' !' : ''}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
