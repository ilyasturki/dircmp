import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { AppConfig } from '~/utils/config'
import type { Action, SortDirection, SortMode } from '~/utils/types'
import { saveConfig } from '~/utils/config'
import { Dialog } from './dialog'

const sortModes: { mode: SortMode; label: string }[] = [
    { mode: 'name', label: 'Name' },
    { mode: 'size', label: 'Size' },
    { mode: 'date', label: 'Date modified' },
    { mode: 'status', label: 'Status' },
]

const itemCount = sortModes.length + 1 // sort modes + dirsFirst toggle

interface SortDialogProps {
    currentMode: SortMode
    currentDirection: SortDirection
    config: AppConfig
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

export function SortDialog({
    currentMode,
    currentDirection,
    config,
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

    const onDirsFirstRow = selectedIndex === sortModes.length

    useInput((input, key) => {
        if (key.escape || input === 'q' || input === 's') {
            dispatch({ type: 'HIDE_SORT_MENU' })
            return
        }

        if (input === 'j' || key.downArrow) {
            setSelectedIndex((i) => Math.min(itemCount - 1, i + 1))
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
            if (onDirsFirstRow) {
                const newConfig = { ...config, dirsFirst: !config.dirsFirst }
                dispatch({ type: 'UPDATE_CONFIG', config: newConfig })
                saveConfig(newConfig)
            } else {
                const item = sortModes[selectedIndex]
                if (item) {
                    dispatch({
                        type: 'SET_SORT',
                        mode: item.mode,
                        close: false,
                    })
                }
            }
            return
        }

        if (key.return) {
            if (onDirsFirstRow) {
                const newConfig = { ...config, dirsFirst: !config.dirsFirst }
                dispatch({ type: 'UPDATE_CONFIG', config: newConfig })
                saveConfig(newConfig)
            } else {
                const item = sortModes[selectedIndex]
                if (item) {
                    dispatch({ type: 'SET_SORT', mode: item.mode })
                }
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
                <Text dimColor>{'  ───'}</Text>
                <Text>
                    {onDirsFirstRow ?
                        <Text
                            bold
                            color='cyan'
                        >
                            {'▸ '}
                        </Text>
                    :   <Text>{'  '}</Text>}
                    <Text bold={onDirsFirstRow}>Directories first</Text>
                    <Text dimColor> {config.dirsFirst ? 'yes' : 'no'}</Text>
                </Text>
            </Box>
            <Text dimColor>j/k navigate Enter select r reverse Esc close</Text>
        </Dialog>
    )
}
