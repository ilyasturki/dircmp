import type { ReactNode } from 'react'
import { Box, Text } from 'ink'
import { memo } from 'react'

import type { CompareEntry, FileEntry } from '~/utils/types'
import { useDateFormatter } from '~/context/date-locale'
import { useNerdFont } from '~/context/nerd-font'
import { ERROR_ICON, ERROR_ICON_PLAIN, getFileIcon } from '~/utils/file-icons'
import { formatSize } from '~/utils/format-size'
import { theme } from '~/utils/theme'

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
                backgroundColor={theme.searchMatchBg}
                color={theme.searchMatchFg}
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
    const content = ''

    return (
        <Box width='100%'>
            <Text
                color={theme.errorText}
                inverse={isSelected}
                backgroundColor={
                    isDimSelected ? theme.dimSelectedBg : undefined
                }
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
    isPendingPairMark = false,
}: {
    entry: CompareEntry
    fileEntry: FileEntry | undefined
    isSelected: boolean
    isDimSelected: boolean
    panelWidth: number
    searchQuery?: string
    isPendingPairMark?: boolean
}) {
    const dateFormatter = useDateFormatter()
    const nerdFont = useNerdFont()
    const errorIcon = nerdFont ? ERROR_ICON : ERROR_ICON_PLAIN
    const hasError = fileEntry?.error
    const isSymlink = entry.type === 'symlink'
    const isBrokenLink = isSymlink && fileEntry?.linkBroken === true
    const showErrorIcon = Boolean(hasError || isBrokenLink)
    const isPaired = !!entry.pairedLeftPath
    const dimColor = !hasError && entry.status === 'identical' && !isPaired
    const color =
        hasError || dimColor ? undefined
        : isPaired ? theme.entryPaired
        : entry.status === 'modified' ? theme.entryModified
        : entry.status === 'only-left' ? theme.entryOnlyLeft
        : entry.status === 'only-right' ? theme.entryOnlyRight
        : isSymlink ? theme.entrySymlink
        : undefined
    const name =
        entry.type === 'directory' ? `${entry.name}/`
        : isSymlink ? `${entry.name}@`
        : entry.name
    const indent = '  '.repeat(entry.depth)
    const icon = getFileIcon(entry.name, entry.type, entry.isExpanded, nerdFont)
    const size = fileEntry ? formatSize(fileEntry.size) : ''
    const date = fileEntry ? dateFormatter.format(fileEntry.modifiedTime) : ''

    const colorIconOnly = entry.type === 'directory' && color && !isSelected

    const errorSuffix = showErrorIcon ? ` ${errorIcon}` : ''
    const pairMark = isPendingPairMark ? ' [m]' : ''
    const left = `${indent}${icon} ${name}`
    const right = `${size}  ${date}`
    const maxLeft =
        panelWidth - right.length - errorSuffix.length - pairMark.length - 1 // at least 1 space gap
    const truncLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left
    const gap = Math.max(
        1,
        panelWidth
            - truncLeft.length
            - errorSuffix.length
            - pairMark.length
            - right.length,
    )

    const prefix = `${indent}${icon} `
    const visibleName = truncLeft.slice(prefix.length)
    const highlightedName = highlightMatches(visibleName, searchQuery)

    const textProps = {
        bold: entry.type === 'directory',
        dimColor,
        color: colorIconOnly ? undefined : color,
        inverse: isSelected,
        backgroundColor: isDimSelected ? theme.dimSelectedBg : undefined,
    } as const

    const nameContent =
        colorIconOnly ?
            <>
                {indent}
                <Text color={color}>{icon} </Text>
                {highlightedName}
            </>
        :   <>
                {prefix}
                {highlightedName}
            </>

    const restContent = (
        <>
            {showErrorIcon && (
                <>
                    {' '}
                    <Text color={theme.errorText}>{errorIcon}</Text>
                </>
            )}
            {' '.repeat(gap)}
            {right}
        </>
    )

    return (
        <Box width='100%'>
            <Text {...textProps}>
                {nameContent}
                {isPendingPairMark && ' '}
            </Text>
            {isPendingPairMark && (
                <Text
                    color={theme.entryPairMark}
                    inverse={isSelected}
                >
                    [m]
                </Text>
            )}
            <Text {...textProps}>{restContent}</Text>
        </Box>
    )
})
