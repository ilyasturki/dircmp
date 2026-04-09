import type { ReactNode } from 'react'
import { Box, Text, useStdout } from 'ink'

import type { CompareEntry, FileEntry } from '~/utils/types'
import { useDateFormatter } from '~/context/date-locale'
import { useTerminalTheme } from '~/context/terminal-theme'
import { getFileIcon } from '~/utils/file-icons'
import { formatSize } from '~/utils/format-size'

function highlightMatches(text: string, query: string): ReactNode {
    if (!query) return text
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const parts: ReactNode[] = []
    let lastIndex = 0
    let idx = lowerText.indexOf(lowerQuery)
    while (idx !== -1) {
        if (idx > lastIndex) {
            parts.push(text.slice(lastIndex, idx))
        }
        parts.push(
            <Text
                key={idx}
                backgroundColor='cyan'
                color='black'
            >
                {text.slice(idx, idx + query.length)}
            </Text>,
        )
        lastIndex = idx + query.length
        idx = lowerText.indexOf(lowerQuery, lastIndex)
    }
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex))
    }
    return parts.length > 0 ? <>{parts}</> : text
}

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
    const theme = useTerminalTheme()
    const dimSelectedBg = theme === 'light' ? '#d4d4d4' : 'gray'
    const content = ''

    return (
        <Box width='100%'>
            <Text
                color='red'
                inverse={isSelected}
                backgroundColor={isDimSelected ? dimSelectedBg : undefined}
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
    searchQuery = '',
}: {
    entry: CompareEntry
    fileEntry: FileEntry | undefined
    isSelected: boolean
    isDimSelected: boolean
    searchQuery?: string
}) {
    const dateFormatter = useDateFormatter()
    const hasError = fileEntry?.error
    const dimColor = !hasError && entry.status === 'identical'
    const color =
        hasError || dimColor ? undefined
        : entry.status === 'modified' ? 'yellow'
        : entry.status === 'only-left' || entry.status === 'only-right' ?
            'green'
        :   undefined
    const name = entry.isDirectory ? `${entry.name}/` : entry.name
    const indent = '  '.repeat(entry.depth)
    const icon = getFileIcon(entry.name, entry.isDirectory, entry.isExpanded)
    const size = fileEntry ? formatSize(fileEntry.size) : ''
    const date = fileEntry ? dateFormatter.format(fileEntry.modifiedTime) : ''

    const panelWidth = usePanelWidth()
    const theme = useTerminalTheme()
    const dimSelectedBg = theme === 'light' ? '#d4d4d4' : 'gray'
    const colorIconOnly = entry.isDirectory && color && !isSelected

    const left = `${indent}${icon} ${name}`
    const right = `${size}  ${date}${hasError ? ' !' : ''}`
    const maxLeft = panelWidth - right.length - 1 // at least 1 space gap
    const truncLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left
    const gap = Math.max(1, panelWidth - truncLeft.length - right.length)

    const prefix = `${indent}${icon} `
    const visibleName = truncLeft.slice(prefix.length)
    const highlightedName = highlightMatches(visibleName, searchQuery)

    return (
        <Box width='100%'>
            <Text
                bold={entry.isDirectory}
                dimColor={dimColor}
                color={colorIconOnly ? undefined : color}
                inverse={isSelected}
                backgroundColor={isDimSelected ? dimSelectedBg : undefined}
            >
                {colorIconOnly ?
                    <>
                        {indent}
                        <Text color={color}>{icon} </Text>
                        {highlightedName}
                        {' '.repeat(gap)}
                        {right}
                    </>
                :   <>
                        {prefix}
                        {highlightedName}
                        {' '.repeat(gap)}
                        {right}
                    </>
                }
            </Text>
        </Box>
    )
}
