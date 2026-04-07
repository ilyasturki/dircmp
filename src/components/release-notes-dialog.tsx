import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useMemo, useRef, useState } from 'react'

import type { Action } from '~/utils/types'
import { Dialog } from './dialog'

interface ReleaseNotesDialogProps {
    changelog: string
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

interface ChangelogLine {
    text: string
    type: 'version' | 'section' | 'item' | 'blank'
}

function wrapText(text: string, width: number, indent: string): string[] {
    if (text.length <= width) return [text]

    const lines: string[] = []
    let remaining = text
    let isFirst = true

    while (remaining.length > 0) {
        const prefix = isFirst ? '' : indent
        const lineWidth = isFirst ? width : width - indent.length

        if (remaining.length <= lineWidth) {
            lines.push(prefix + remaining)
            break
        }

        let breakPoint = remaining.lastIndexOf(' ', lineWidth)
        if (breakPoint <= 0) breakPoint = lineWidth
        lines.push(prefix + remaining.slice(0, breakPoint))
        remaining = remaining.slice(breakPoint).trimStart()
        isFirst = false
    }

    return lines
}

function parseChangelog(raw: string, width: number): ChangelogLine[] {
    const lines: ChangelogLine[] = []
    for (const line of raw.split('\n')) {
        if (line.startsWith('# ')) continue
        if (line.startsWith('## ')) {
            const text = line.replace(/^## /, '')
            for (const wrapped of wrapText(text, width, '')) {
                lines.push({ text: wrapped, type: 'version' })
            }
        } else if (line.startsWith('### ')) {
            const text = line.replace(/^### /, '')
            for (const wrapped of wrapText(text, width, '')) {
                lines.push({ text: wrapped, type: 'section' })
            }
        } else if (line.startsWith('- ')) {
            for (const wrapped of wrapText(line, width, '  ')) {
                lines.push({ text: wrapped, type: 'item' })
            }
        } else if (line.trim() === '') {
            lines.push({ text: '', type: 'blank' })
        } else {
            for (const wrapped of wrapText(line, width, '')) {
                lines.push({ text: wrapped, type: 'item' })
            }
        }
    }
    // Trim trailing blank lines
    while (lines.length > 0 && lines[lines.length - 1]!.type === 'blank') {
        lines.pop()
    }
    return lines
}

function filterLines(lines: ChangelogLine[], query: string): ChangelogLine[] {
    if (!query) return lines
    const q = query.toLowerCase()
    const matchingIndices = new Set<number>()
    for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.text.toLowerCase().includes(q)) {
            matchingIndices.add(i)
        }
    }
    // Include version/section headers as context anchors
    const keep = new Set<number>(matchingIndices)
    for (const idx of matchingIndices) {
        for (let j = idx - 1; j >= 0; j--) {
            const type = lines[j]!.type
            if (type === 'version') {
                keep.add(j)
                break
            }
            if (type === 'section') {
                keep.add(j)
            }
        }
    }
    return lines.filter((_, i) => keep.has(i))
}

export function ReleaseNotesDialog({
    changelog,
    dispatch,
    columns,
    rows,
}: ReleaseNotesDialogProps) {
    const dialogWidth = Math.min(80, columns - 8)
    const contentWidth = dialogWidth - 6

    const allLines = useMemo(
        () => parseChangelog(changelog, contentWidth),
        [changelog, contentWidth],
    )
    const [scrollOffset, setScrollOffset] = useState(0)
    const [searchActive, setSearchActive] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const pendingGRef = useRef(false)

    const filteredLines = useMemo(
        () => filterLines(allLines, searchQuery),
        [allLines, searchQuery],
    )
    // Reserve rows for dialog chrome: border (2) + paddingY (2) + title (1) + gap (1) + search bar (1) + footer (1) = 8
    const maxVisibleLines = Math.max(1, rows - 12)
    const maxScroll = Math.max(0, filteredLines.length - maxVisibleLines)

    const visibleLines = filteredLines.slice(
        scrollOffset,
        scrollOffset + maxVisibleLines,
    )

    function handleSearchChange(value: string) {
        setSearchQuery(value)
        setScrollOffset(0)
    }

    useInput((input, key) => {
        if (searchActive) {
            if (key.escape) {
                setSearchActive(false)
                setSearchQuery('')
                setScrollOffset(0)
            }
            if (key.return) {
                setSearchActive(false)
            }
            return
        }

        if (key.escape || input === 'q') {
            dispatch({ type: 'HIDE_RELEASE_NOTES' })
            return
        }

        if (input === '/') {
            setSearchActive(true)
            return
        }

        // gg — go to top
        if (input === 'g') {
            if (pendingGRef.current) {
                pendingGRef.current = false
                setScrollOffset(0)
            } else {
                pendingGRef.current = true
            }
            return
        }
        pendingGRef.current = false

        if (input === 'j' || key.downArrow) {
            setScrollOffset((prev) => Math.min(maxScroll, prev + 1))
            return
        }
        if (input === 'k' || key.upArrow) {
            setScrollOffset((prev) => Math.max(0, prev - 1))
            return
        }
        if (input === 'G') {
            setScrollOffset(maxScroll)
            return
        }
        if (key.ctrl && input === 'd') {
            const half = Math.floor(maxVisibleLines / 2)
            setScrollOffset((prev) => Math.min(maxScroll, prev + half))
            return
        }
        if (key.ctrl && input === 'u') {
            const half = Math.floor(maxVisibleLines / 2)
            setScrollOffset((prev) => Math.max(0, prev - half))
            return
        }
        if (key.ctrl && input === 'f') {
            setScrollOffset((prev) =>
                Math.min(maxScroll, prev + maxVisibleLines),
            )
            return
        }
        if (key.ctrl && input === 'b') {
            setScrollOffset((prev) => Math.max(0, prev - maxVisibleLines))
            return
        }
    })

    if (!changelog) {
        return (
            <Dialog
                title='Release Notes'
                columns={columns}
                rows={rows}
                width={dialogWidth}
            >
                <Box flexDirection='column'>
                    <Text dimColor>Release notes not available.</Text>
                    <Text dimColor>
                        Visit
                        github.com/ilyasturki/dircmp/blob/main/CHANGELOG.md
                    </Text>
                </Box>
            </Dialog>
        )
    }

    return (
        <Dialog
            title='Release Notes'
            columns={columns}
            rows={rows}
            width={dialogWidth}
        >
            <Box flexDirection='column'>
                {searchActive ?
                    <Box>
                        <Text>
                            <Text color='cyan'>/</Text>
                            <TextInput
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onSubmit={() => setSearchActive(false)}
                                focus={true}
                            />
                        </Text>
                        <Text dimColor>
                            {' '}
                            {filteredLines.length}/{allLines.length}
                        </Text>
                    </Box>
                : searchQuery ?
                    <Text dimColor>
                        /{searchQuery} ({filteredLines.length}/{allLines.length}
                        )
                    </Text>
                :   <Text dimColor>
                        {filteredLines.length} lines | /: search | q: close
                    </Text>
                }
                {filteredLines.length === 0 && searchQuery ?
                    <Text dimColor>No matches</Text>
                :   visibleLines.map((line, i) => {
                        const pad = ' '.repeat(
                            Math.max(0, contentWidth - line.text.length),
                        )
                        if (line.type === 'version') {
                            return (
                                <Text
                                    key={scrollOffset + i}
                                    bold
                                    color='cyan'
                                >
                                    {line.text}
                                    {pad}
                                </Text>
                            )
                        }
                        if (line.type === 'section') {
                            return (
                                <Text
                                    key={scrollOffset + i}
                                    color='yellow'
                                >
                                    {line.text}
                                    {pad}
                                </Text>
                            )
                        }
                        if (line.type === 'blank') {
                            return <Text key={scrollOffset + i}> </Text>
                        }
                        return (
                            <Text key={scrollOffset + i}>
                                {line.text}
                                {pad}
                            </Text>
                        )
                    })
                }
                {Array.from(
                    { length: maxVisibleLines - visibleLines.length },
                    (_, i) => (
                        <Text key={`pad-${i}`}> </Text>
                    ),
                )}
            </Box>
        </Dialog>
    )
}
