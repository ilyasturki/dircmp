import { Box, Text } from "ink";
import { TitledBox, titleStyles } from "@mishieck/ink-titled-box";
import type { CompareEntry, PanelSide } from "~/utils/types";

interface DirectoryPanelProps {
  rootPath: string;
  currentPath: string;
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

export function DirectoryPanel({
  rootPath,
  currentPath,
  entries,
  cursorIndex,
  isFocused,
  side,
  visibleHeight,
  scrollOffset,
}: DirectoryPanelProps) {
  const displayPath = currentPath === "" ? "/" : `/${currentPath}`;
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
      titles={[rootPath + displayPath]}
    >
      {entries.length === 0 ? (
        <Box>
          <Text dimColor>(empty)</Text>
        </Box>
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
              <Box key={entry.relativePath + "-" + side}>
                <Text dimColor inverse={isSelected} backgroundColor={isDimSelected ? "gray" : undefined}>
  {"    (missing)"}
                </Text>
              </Box>
            );
          }

          const fileEntry = side === "left" ? entry.left : entry.right;
          const hasError = fileEntry?.error;

          const dimColor = !hasError && entry.status === "identical";

          const name = entry.isDirectory ? `${entry.name}/` : entry.name;
          const arrow = entry.isDirectory ? "▶ " : "  ";
          const date = fileEntry ? formatDate(fileEntry.modifiedTime) : "";

          return (
            <Box key={entry.relativePath + "-" + side}>
              <Text
                bold={entry.isDirectory}
                dimColor={dimColor}
                inverse={isSelected}
                backgroundColor={isDimSelected ? "gray" : undefined}
              >
                {`${arrow}${name.padEnd(24).slice(0, 24)} ${date}`}
                {hasError ? " !" : ""}
              </Text>
            </Box>
          );
        })
      )}
    </TitledBox>
  );
}
