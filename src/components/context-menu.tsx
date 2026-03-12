import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action, CompareEntry, PanelSide } from '~/utils/types'
import { Dialog } from './dialog'

interface MenuItem {
    label: string
    hint: string
    action: Action
}

function getMenuItems(
    entry: CompareEntry,
    side: PanelSide,
): MenuItem[] {
    const items: MenuItem[] = []

    if (entry.isDirectory) {
        items.push({
            label: 'Expand / Collapse',
            hint: 'l',
            action: { type: 'NAVIGATE_INTO' },
        })
    } else {
        if (entry.status !== 'identical') {
            items.push({
                label: 'Open diff',
                hint: 'Enter',
                action: { type: 'OPEN_DIFF' },
            })
        }
    }

    if (
        entry.status === 'modified'
        || entry.status === 'only-left'
    ) {
        items.push({
            label: 'Copy to right',
            hint: '>',
            action: { type: 'COPY_TO_RIGHT' },
        })
    }

    if (
        entry.status === 'modified'
        || entry.status === 'only-right'
    ) {
        items.push({
            label: 'Copy to left',
            hint: '<',
            action: { type: 'COPY_TO_LEFT' },
        })
    }

    const file = side === 'left' ? entry.left : entry.right
    if (file) {
        items.push({
            label: `Delete from ${side}`,
            hint: 'x',
            action: { type: 'CONFIRM_DELETE' },
        })
    }

    return items
}

interface ContextMenuProps {
    entry: CompareEntry
    side: PanelSide
    dispatch: Dispatch<Action>
    onExecuteAction: (action: Action) => void
    columns: number
    rows: number
}

export function ContextMenu({
    entry,
    side,
    dispatch,
    onExecuteAction,
    columns,
    rows,
}: ContextMenuProps) {
    const items = getMenuItems(entry, side)
    const [selectedIndex, setSelectedIndex] = useState(0)

    useInput((input, key) => {
        if (key.escape || input === 'q' || input === '.') {
            dispatch({ type: 'HIDE_CONTEXT_MENU' })
            return
        }

        if (items.length === 0) return

        if (input === 'j' || key.downArrow) {
            setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
            return
        }
        if (input === 'k' || key.upArrow) {
            setSelectedIndex((i) => Math.max(0, i - 1))
            return
        }

        if (key.return) {
            const item = items[selectedIndex]
            if (!item) return
            dispatch({ type: 'HIDE_CONTEXT_MENU' })
            onExecuteAction(item.action)
        }
    })

    return (
        <Dialog
            title={entry.name}
            columns={columns}
            rows={rows}
        >
            {items.length === 0 ?
                <Text dimColor>No actions available</Text>
            :   <Box flexDirection='column'>
                    {items.map((item, i) => (
                        <Text key={item.label}>
                            {i === selectedIndex ?
                                <Text bold color='cyan'>
                                    {'▸ '}
                                </Text>
                            :   <Text>{'  '}</Text>}
                            <Text bold={i === selectedIndex}>
                                {item.label}
                            </Text>
                            <Text dimColor>{`  ${item.hint}`}</Text>
                        </Text>
                    ))}
                </Box>
            }
            <Text dimColor>
                j/k navigate  Enter select  Esc close
            </Text>
        </Dialog>
    )
}
