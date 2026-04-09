import type { ReactNode } from 'react'
import { Box, Text } from 'ink'
import { memo } from 'react'

import type { CompareEntry, FileEntry } from '~/utils/types'
import { useDateFormatter } from '~/context/date-locale'
import { useNerdFont } from '~/context/nerd-font'
import { ERROR_ICON, ERROR_ICON_PLAIN, getFileIcon } from '~/utils/file-icons'
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

export const MissingEntryRow = memo(function MissingEntryRow({
    isSelected,
    isDimSelected,
    panelWidth,
}: {
    isSelected: boolean
    isDimSelected: boolean
    panelWidth: number
}) {
    const dimSelectedBg = 'white'
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
})

export const EntryRow = memo(function EntryRow({
    entry,
    fileEntry,
    isSelected,
    isDimSelected,
    panelWidth,
    searchQuery = '',
}: {
    entry: CompareEntry
    fileEntry: FileEntry | undefined
    isSelected: boolean
    isDimSelected: boolean
    panelWidth: number
    searchQuery?: string
}) {
    const dateFormatter = useDateFormatter()
    const nerdFont = useNerdFont()
    const errorIcon = nerdFont ? ERROR_ICON : ERROR_ICON_PLAIN
    const hasError = fileEntry?.error
    const isPaired = !!entry.pairedLeftPath
    const dimColor = !hasError && entry.status === 'identical' && !isPaired
    const color =
        hasError || dimColor ? undefined
        : isPaired ? 'magenta'
        : entry.status === 'modified' ? 'yellow'
        : entry.status === 'only-left' || entry.status === 'only-right' ?
            'green'
        :   undefined
    const name = entry.isDirectory ? `${entry.name}/` : entry.name
    const indent = '  '.repeat(entry.depth)
    const icon = getFileIcon(
        entry.name,
        entry.isDirectory,
        entry.isExpanded,
        nerdFont,
    )
    const size = fileEntry ? formatSize(fileEntry.size) : ''
    const date = fileEntry ? dateFormatter.format(fileEntry.modifiedTime) : ''

    const dimSelectedBg = 'white'
    const colorIconOnly = entry.isDirectory && color && !isSelected

    const errorSuffix = hasError ? ` ${errorIcon}` : ''
    const left = `${indent}${icon} ${name}`
    const right = `${size}  ${date}`
    const maxLeft = panelWidth - right.length - errorSuffix.length - 1 // at least 1 space gap
    const truncLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left
    const gap = Math.max(
        1,
        panelWidth - truncLeft.length - errorSuffix.length - right.length,
    )

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
                        {hasError && <Text color='red'> {errorIcon}</Text>}
                        {' '.repeat(gap)}
                        {right}
                    </>
                :   <>
                        {prefix}
                        {highlightedName}
                        {hasError && <Text color='red'> {errorIcon}</Text>}
                        {' '.repeat(gap)}
                        {right}
                    </>
                }
            </Text>
        </Box>
    )
})
