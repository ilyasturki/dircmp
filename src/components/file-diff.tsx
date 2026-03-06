import { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { DiffResult } from '~/utils/types.js';

interface FileDiffProps {
  filePath: string;
  diffResult: DiffResult | null;
  scrollOffset: number;
  visibleHeight: number;
}

interface DisplayLine {
  lineNo: string;
  content: string;
  type: 'header' | 'added' | 'removed' | 'context';
}

function flattenDiff(diff: DiffResult): DisplayLine[] {
  const lines: DisplayLine[] = [];
  let lineNo = 0;

  for (const hunk of diff.hunks) {
    lines.push({ lineNo: '', content: hunk.header, type: 'header' });
    for (const line of hunk.lines) {
      lineNo++;
      const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      lines.push({
        lineNo: lineNo.toString(),
        content: `${prefix}${line.content}`,
        type: line.type === 'added' ? 'added' : line.type === 'removed' ? 'removed' : 'context',
      });
    }
  }

  return lines;
}

export function FileDiff({
  filePath,
  diffResult,
  scrollOffset,
  visibleHeight,
}: FileDiffProps) {
  if (!diffResult) {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="cyan">
        <Text color="yellow">Computing diff...</Text>
      </Box>
    );
  }

  if (diffResult.isBinary) {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="cyan">
        <Box>
          <Text bold color="cyan">{filePath}</Text>
        </Box>
        <Box>
          <Text color="yellow">Binary files differ</Text>
        </Box>
      </Box>
    );
  }

  if (diffResult.hunks.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="cyan">
        <Box>
          <Text bold color="cyan">{filePath}</Text>
        </Box>
        <Box>
          <Text dimColor>Files are identical</Text>
        </Box>
      </Box>
    );
  }

  const displayLines = useMemo(() => flattenDiff(diffResult), [diffResult]);
  const visible = displayLines.slice(scrollOffset, scrollOffset + visibleHeight);
  const gutterWidth = displayLines.length.toString().length + 1;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan">
      <Box>
        <Text bold color="cyan">{filePath}</Text>
      </Box>
      {visible.map((line, i) => {
        const gutter = line.lineNo.padStart(gutterWidth);
        let color: string | undefined;
        let bold = false;

        switch (line.type) {
          case 'header':
            color = 'cyan';
            bold = true;
            break;
          case 'added':
            color = 'green';
            break;
          case 'removed':
            color = 'red';
            break;
        }

        return (
          <Box key={scrollOffset + i}>
            <Text dimColor>{gutter} </Text>
            <Text color={color} bold={bold}>
              {line.content}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function getDiffLineCount(diffResult: DiffResult | null): number {
  if (!diffResult || diffResult.isBinary) return 0;
  let count = 0;
  for (const hunk of diffResult.hunks) {
    count += 1 + hunk.lines.length; // header + lines
  }
  return count;
}
