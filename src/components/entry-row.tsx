import { Box, Text } from "ink";
import type { CompareEntry, FileEntry } from "~/utils/types";

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

export function MissingEntryRow({
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

export function EntryRow({
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
