import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import { getHelpItems } from '~/keymap'
import { Dialog } from './dialog'

interface HelpDialogProps {
    dispatch: Dispatch<Action>
    onExecuteAction: (action: Action) => void
    onExit: () => void
    columns: number
    rows: number
}

export function HelpDialog({
    dispatch,
    onExecuteAction,
    onExit,
    columns,
    rows,
}: HelpDialogProps) {
    const items = getHelpItems()
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [scrollOffset, setScrollOffset] = useState(0)

    // Reserve rows for dialog chrome: border (2) + paddingY (2) + title (1) + gaps (2) + footer (1) = 8
    const maxVisibleItems = Math.max(1, rows - 12)

    const visibleItems = items.slice(
        scrollOffset,
        scrollOffset + maxVisibleItems,
    )

    useInput((input, key) => {
        if (key.escape || input === '?' || input === 'q') {
            dispatch({ type: 'HIDE_HELP' })
            return
        }

        if (input === 'j' || key.downArrow) {
            setSelectedIndex((prev) => {
                const next = Math.min(items.length - 1, prev + 1)
                setScrollOffset((offset) => {
                    if (next >= offset + maxVisibleItems)
                        return next - maxVisibleItems + 1
                    return offset
                })
                return next
            })
            return
        }
        if (input === 'k' || key.upArrow) {
            setSelectedIndex((prev) => {
                const next = Math.max(0, prev - 1)
                setScrollOffset((offset) => {
                    if (next < offset) return next
                    return offset
                })
                return next
            })
            return
        }
        if (input === 'G') {
            setSelectedIndex(items.length - 1)
            setScrollOffset(Math.max(0, items.length - maxVisibleItems))
            return
        }

        if (key.return) {
            const item = items[selectedIndex]
            if (!item) return
            dispatch({ type: 'HIDE_HELP' })
            if (item.effect.type === 'exit') {
                onExit()
            } else {
                onExecuteAction(item.effect.action)
            }
            return
        }
    })

    const maxKeyWidth = Math.max(...items.map((item) => item.key.length))

    return (
        <Dialog
            title='Keybindings'
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                {visibleItems.map((item, i) => {
                    const absoluteIndex = scrollOffset + i
                    const isSelected = absoluteIndex === selectedIndex
                    return (
                        <Text
                            key={absoluteIndex}
                            inverse={isSelected}
                        >
                            <Text
                                bold={isSelected}
                                color='green'
                            >
                                {'  '}
                                {item.key.padEnd(maxKeyWidth)}
                            </Text>
                            <Text bold={isSelected}>
                                {'  '}
                                {item.description}
                            </Text>
                        </Text>
                    )
                })}
            </Box>
            <Box justifyContent='flex-end'>
                <Text dimColor>
                    {selectedIndex + 1} of {items.length}
                </Text>
            </Box>
        </Dialog>
    )
}
