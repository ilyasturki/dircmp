import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'

import type { Action, CompareEntry, PanelSide } from '~/utils/types'
import { useListNavigation } from '~/hooks'
import { Dialog } from './dialog'
import { KeyboardHints } from './keyboard-hints'

interface MenuItem {
    label: string
    hint: string
    action: Action
}

function getMenuItems(entry: CompareEntry, side: PanelSide): MenuItem[] {
    const items: MenuItem[] = []

    if (entry.type === 'directory') {
        items.push({
            label: 'Expand / Collapse',
            hint: 'l',
            action: { type: 'NAVIGATE_INTO' },
        })
    } else {
        items.push({
            label: 'Open diff',
            hint: 'Enter',
            action: { type: 'OPEN_FILE_DIFF' },
        })
    }

    if (entry.status === 'modified' || entry.status === 'only-left') {
        items.push({
            label: 'Copy to right',
            hint: '>',
            action: { type: 'COPY_TO_RIGHT' },
        })
    }

    if (entry.status === 'modified' || entry.status === 'only-right') {
        items.push({
            label: 'Copy to left',
            hint: '<',
            action: { type: 'COPY_TO_LEFT' },
        })
    }

    if (
        entry.type === 'directory'
        && (entry.status === 'only-left' || entry.status === 'only-right')
    ) {
        items.push({
            label: 'Pair directory',
            hint: 'm',
            action: { type: 'MARK_PAIR' },
        })
    }

    if (entry.pairedLeftPath) {
        items.push({
            label: 'Unpair directory',
            hint: 'u',
            action: { type: 'UNPAIR' },
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
    const {
        selectedIndex,
        scrollTo,
        handleInput: handleNav,
    } = useListNavigation({
        itemCount: items.length,
        maxVisibleItems: items.length,
    })

    useInput((input, key) => {
        if (key.escape || input === 'q' || input === '.') {
            dispatch({ type: 'HIDE_CONTEXT_MENU' })
            return
        }

        if (items.length === 0) return

        if (handleNav(input, key)) return

        if (key.return) {
            const item = items[selectedIndex]
            if (!item) return
            dispatch({ type: 'HIDE_CONTEXT_MENU' })
            onExecuteAction(item.action)
            return
        }

        const hintIndex = items.findIndex((item) => item.hint === input)
        if (hintIndex !== -1) {
            scrollTo(hintIndex)
        }
    })

    return (
        <Dialog
            title={entry.relativePath}
            columns={columns}
            rows={rows}
        >
            {items.length === 0 ?
                <Text dimColor>No actions available</Text>
            :   <Box flexDirection='column'>
                    {items.map((item, i) => (
                        <Text key={item.label}>
                            {i === selectedIndex ?
                                <Text
                                    bold
                                    color='cyan'
                                >
                                    {'▸ '}
                                </Text>
                            :   <Text>{'  '}</Text>}
                            <Text bold={i === selectedIndex}>{item.label}</Text>
                            <Text dimColor>{`  ${item.hint}`}</Text>
                        </Text>
                    ))}
                </Box>
            }
            <KeyboardHints
                items={[
                    { key: 'j/k', label: 'navigate' },
                    { key: '<enter>', label: 'select' },
                    { key: 'esc', label: 'close' },
                ]}
                columns={columns}
            />
        </Dialog>
    )
}
