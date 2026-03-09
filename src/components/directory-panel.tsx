import { useMemo } from "react";
import { Box, Text } from "ink";
import { TitledBox, titleStyles } from "@mishieck/ink-titled-box";
import type { CompareEntry, FileEntry, PanelSide } from "~/utils/types";
import { EntryRow, MissingEntryRow } from "./entry-row";

interface DirectoryPanelProps {
  rootPath: string;
  entries: CompareEntry[];
  cursorIndex: number;
  isFocused: boolean;
  side: PanelSide;
  visibleHeight: number;
  scrollOffset: number;
  dateLocale: string | undefined;
}


function EmptyPanel() {
  return (
    <Box>
      <Text dimColor>(empty)</Text>
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
  dateLocale,
}: DirectoryPanelProps) {
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(dateLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    [dateLocale],
  );

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
              dateFormatter={dateFormatter}
            />
          );
        })
      )}
    </TitledBox>
  );
}
