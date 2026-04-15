import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'

import type { Action, FilterMode } from '~/utils/types'
import { useListNavigation } from '~/hooks'
import { theme } from '~/utils/theme'
import { Dialog } from '../dialog'
import { KeyboardHints } from '../keyboard-hints'

const filterModes: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: 'All' },
    { mode: 'all-changes', label: 'All changes' },
    { mode: 'modified', label: 'Only modified' },
    { mode: 'only-left', label: 'Only left' },
    { mode: 'only-right', label: 'Only right' },
    { mode: 'same', label: 'Same' },
]

interface FilterDialogProps {
    currentMode: FilterMode
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

export function FilterDialog({
    currentMode,
    dispatch,
    columns,
    rows,
}: FilterDialogProps) {
    const { selectedIndex, handleInput: handleNav } = useListNavigation({
        itemCount: filterModes.length,
        maxVisibleItems: filterModes.length,
        initialIndex: Math.max(
            0,
            filterModes.findIndex((m) => m.mode === currentMode),
        ),
    })

    useInput((input, key) => {
        if (key.escape || input === 'q' || input === 'f') {
            dispatch({ type: 'HIDE_FILTER_MENU' })
            return
        }

        if (handleNav(input, key)) return

        if (input === ' ') {
            const item = filterModes[selectedIndex]
            if (item) {
                dispatch({ type: 'SET_FILTER', mode: item.mode, close: false })
            }
            return
        }

        if (key.return) {
            const item = filterModes[selectedIndex]
            if (item) {
                dispatch({ type: 'SET_FILTER', mode: item.mode })
            }
            return
        }
    })

    return (
        <Dialog
            title='Filter'
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                {filterModes.map((item, i) => (
                    <Text key={item.mode}>
                        {i === selectedIndex ?
                            <Text
                                bold
                                color={theme.selectionMarker}
                            >
                                {'▸ '}
                            </Text>
                        :   <Text>{'  '}</Text>}
                        <Text bold={i === selectedIndex}>{item.label}</Text>
                        {item.mode === currentMode && (
                            <Text color={theme.selectionMarker}> ✓</Text>
                        )}
                    </Text>
                ))}
            </Box>
            <KeyboardHints
                items={[
                    { key: 'j/k', label: 'navigate' },
                    { key: '<enter>', label: 'select' },
                    { key: '<space>', label: 'apply' },
                    { key: 'esc', label: 'close' },
                ]}
                columns={columns}
            />
        </Dialog>
    )
}
