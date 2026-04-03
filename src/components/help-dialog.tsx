import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import type { Shortcut } from '~/keymap'
import { getHelpItems } from '~/keymap'
import { Dialog } from './dialog'

interface HelpDialogProps {
    keymap: Shortcut[]
    dispatch: Dispatch<Action>
    onExecuteAction: (action: Action) => void
    onExit: () => void
    columns: number
    rows: number
}

export function HelpDialog({
    keymap,
    dispatch,
    onExecuteAction,
    onExit,
    columns,
    rows,
}: HelpDialogProps) {
    const items = getHelpItems(keymap)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [scrollOffset, setScrollOffset] = useState(0)

    // Reserve rows for dialog chrome: border (2) + paddingY (2) + title (1) + gap (1) = 6
    const maxVisibleItems = Math.max(1, rows - 10)

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
    // Dialog chrome: border (2) + paddingX (4) = 6 cols
    const dialogWidth = Math.min(50, columns - 4)
    const contentWidth = dialogWidth - 6

    return (
        <Dialog
            title='Keybindings'
            columns={columns}
            rows={rows}
            width={dialogWidth}
        >
            <Box flexDirection='column'>
                {visibleItems.map((item, i) => {
                    const absoluteIndex = scrollOffset + i
                    const isSelected = absoluteIndex === selectedIndex
                    const keyPad = maxKeyWidth - item.key.length
                    const keyPart =
                        ' '.repeat(keyPad) + item.key + ' '
                    const descPart = ` ${item.helpDescription}`
                    const usedWidth = maxKeyWidth + 1 + descPart.length
                    const pad = Math.max(0, contentWidth - usedWidth)
                    return (
                        <Text
                            key={absoluteIndex}
                            inverse={isSelected}
                        >
                            <Text color='cyan'>{keyPart}</Text>
                            {descPart}
                            {' '.repeat(pad)}
                        </Text>
                    )
                })}
            </Box>
        </Dialog>
    )
}
