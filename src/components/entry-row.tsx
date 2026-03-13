import { Box, Text, useStdout } from 'ink'

import type { CompareEntry, FileEntry } from '~/utils/types'
import { useDateFormatter } from '~/context/date-locale'
import { getFileIcon } from '~/utils/file-icons'

/** Available width inside one panel (half terminal minus border chrome) */
function usePanelWidth() {
    const { stdout } = useStdout()
    const columns = stdout?.columns ?? 80
    // Each panel is 50% width, border takes 2 chars on each side
    return Math.floor(columns / 2) - 2
}

export function MissingEntryRow({
    isSelected,
    isDimSelected,
}: {
    isSelected: boolean
    isDimSelected: boolean
}) {
    const panelWidth = usePanelWidth()
    const content = ''

    return (
        <Box width='100%'>
            <Text
                color="red"
                inverse={isSelected}
                backgroundColor={isDimSelected ? 'gray' : undefined}
            >
                {content.padEnd(panelWidth)}
            </Text>
        </Box>
    )
}

export function EntryRow({
    entry,
    fileEntry,
    isSelected,
    isDimSelected,
}: {
    entry: CompareEntry
    fileEntry: FileEntry | undefined
    isSelected: boolean
    isDimSelected: boolean
}) {
    const dateFormatter = useDateFormatter()
    const hasError = fileEntry?.error
    const dimColor = !hasError && entry.status === 'identical'
    const color =
        hasError || dimColor
            ? undefined
            : entry.status === 'modified'
              ? 'yellow'
              : entry.status === 'only-left' || entry.status === 'only-right'
                ? 'green'
                : undefined
    const name = entry.isDirectory ? `${entry.name}/` : entry.name
    const indent = '  '.repeat(entry.depth)
    const icon = getFileIcon(entry.name, entry.isDirectory, entry.isExpanded)
    const date = fileEntry ? dateFormatter.format(fileEntry.modifiedTime) : ''

    const panelWidth = usePanelWidth()
    const colorIconOnly = entry.isDirectory && color

    const left = `${indent}${icon} ${name}`
    const right = `${date}${hasError ? ' !' : ''}`
    const maxLeft = panelWidth - right.length - 1 // at least 1 space gap
    const truncLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left
    const gap = Math.max(1, panelWidth - truncLeft.length - right.length)

    return (
        <Box width='100%'>
            <Text
                bold={entry.isDirectory}
                dimColor={dimColor}
                color={colorIconOnly ? undefined : color}
                inverse={isSelected}
                backgroundColor={isDimSelected ? 'gray' : undefined}
            >
                {colorIconOnly ? (
                    <>
                        {indent}
                        <Text color={color}>{icon} </Text>
                        {truncLeft.slice(indent.length + icon.length + 1)}{' '.repeat(gap)}{right}
                    </>
                ) : (
                    `${truncLeft}${' '.repeat(gap)}${right}`
                )}
            </Text>
        </Box>
    )
}
