import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action, SortDirection, SortMode } from '~/utils/types'
import { Dialog } from './dialog'

const sortModes: { mode: SortMode; label: string }[] = [
    { mode: 'name', label: 'Name' },
    { mode: 'size', label: 'Size' },
]

interface SortDialogProps {
    currentMode: SortMode
    currentDirection: SortDirection
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

export function SortDialog({
    currentMode,
    currentDirection,
    dispatch,
    columns,
    rows,
}: SortDialogProps) {
    const [selectedIndex, setSelectedIndex] = useState(
        Math.max(
            0,
            sortModes.findIndex((m) => m.mode === currentMode),
        ),
    )

    useInput((input, key) => {
        if (key.escape || input === 'q' || input === 's') {
            dispatch({ type: 'HIDE_SORT_MENU' })
            return
        }

        if (input === 'j' || key.downArrow) {
            setSelectedIndex((i) => Math.min(sortModes.length - 1, i + 1))
            return
        }
        if (input === 'k' || key.upArrow) {
            setSelectedIndex((i) => Math.max(0, i - 1))
            return
        }

        if (input === 'r') {
            dispatch({ type: 'TOGGLE_SORT_DIRECTION' })
            return
        }

        if (input === ' ') {
            const item = sortModes[selectedIndex]
            if (item) {
                dispatch({ type: 'SET_SORT', mode: item.mode, close: false })
            }
            return
        }

        if (key.return) {
            const item = sortModes[selectedIndex]
            if (item) {
                dispatch({ type: 'SET_SORT', mode: item.mode })
            }
            return
        }
    })

    const dirArrow = currentDirection === 'asc' ? '↑' : '↓'

    return (
        <Dialog
            title='Sort'
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                {sortModes.map((item, i) => (
                    <Text key={item.mode}>
                        {i === selectedIndex ?
                            <Text
                                bold
                                color='cyan'
                            >
                                {'▸ '}
                            </Text>
                        :   <Text>{'  '}</Text>}
                        <Text bold={i === selectedIndex}>{item.label}</Text>
                        {item.mode === currentMode && (
                            <Text color='cyan'>{` ${dirArrow}`}</Text>
                        )}
                    </Text>
                ))}
            </Box>
            <Text dimColor>j/k navigate Enter select r reverse Esc close</Text>
        </Dialog>
    )
}
