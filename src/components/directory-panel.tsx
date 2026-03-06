import { Box, Text } from "ink";
import { TitledBox, titleStyles } from "@mishieck/ink-titled-box";
import type { CompareEntry, FileEntry, PanelSide } from "~/utils/types";

interface DirectoryPanelProps {
  rootPath: string;
  entries: CompareEntry[];
  cursorIndex: number;
  isFocused: boolean;
  side: PanelSide;
  visibleHeight: number;
  scrollOffset: number;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

function EmptyPanel() {
  return (
    <Box>
      <Text dimColor>(empty)</Text>
    </Box>
  );
}

function MissingEntryRow({
  isSelected,
  isDimSelected,
}: {
  isSelected: boolean;
  isDimSelected: boolean;
}) {
  return (
    <Box>
      <Text dimColor inverse={isSelected} backgroundColor={isDimSelected ? "gray" : undefined}>
        {"    (missing)"}
      </Text>
    </Box>
  );
}

function EntryRow({
  entry,
  fileEntry,
  isSelected,
  isDimSelected,
}: {
  entry: CompareEntry;
  fileEntry: FileEntry | undefined;
  isSelected: boolean;
  isDimSelected: boolean;
}) {
  const hasError = fileEntry?.error;
  const dimColor = !hasError && entry.status === "identical";
  const name = entry.isDirectory ? `${entry.name}/` : entry.name;
  const indent = "  ".repeat(entry.depth);
  const arrow = entry.isDirectory
    ? entry.isExpanded ? "▼ " : "▶ "
    : "  ";
  const nameWidth = Math.max(8, 24 - entry.depth * 2);
  const date = fileEntry ? formatDate(fileEntry.modifiedTime) : "";

  return (
    <Box>
      <Text
        bold={entry.isDirectory}
        dimColor={dimColor}
        inverse={isSelected}
        backgroundColor={isDimSelected ? "gray" : undefined}
      >
        {`${indent}${arrow}${name.padEnd(nameWidth).slice(0, nameWidth)} ${date}`}
        {hasError ? " !" : ""}
      </Text>
    </Box>
  );
}

export function DirectoryPanel({
  rootPath,
  entries,
  cursorIndex,
  isFocused,
  side,
  visibleHeight,
  scrollOffset,
}: DirectoryPanelProps) {
  const visibleEntries = entries.slice(
    scrollOffset,
    scrollOffset + visibleHeight,
  );

  return (
    <TitledBox
      flexDirection="column"
      width="50%"
      borderStyle="bold"
      borderColor={isFocused ? "cyan" : "gray"}
      titles={[rootPath]}
    >
      {entries.length === 0 ? (
        <EmptyPanel />
      ) : (
        visibleEntries.map((entry, i) => {
          const absoluteIndex = scrollOffset + i;
          const isCursorRow = absoluteIndex === cursorIndex;
          const isSelected = isCursorRow && isFocused;
          const isDimSelected = isCursorRow && !isFocused;
          const isMissingSide =
            (side === "left" && entry.status === "only-right") ||
            (side === "right" && entry.status === "only-left");

          if (isMissingSide) {
            return (
              <MissingEntryRow
                key={entry.relativePath + "-" + side}
                isSelected={isSelected}
                isDimSelected={isDimSelected}
              />
            );
          }

          const fileEntry = side === "left" ? entry.left : entry.right;

          return (
            <EntryRow
              key={entry.relativePath + "-" + side}
              entry={entry}
              fileEntry={fileEntry}
              isSelected={isSelected}
              isDimSelected={isDimSelected}
            />
          );
        })
      )}
    </TitledBox>
  );
}
