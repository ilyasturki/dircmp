import type { Dispatch } from 'react'
import path from 'node:path'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action, CompareEntry, PanelSide, UndoEntry } from '~/utils/types'
import { theme } from '~/utils/theme'
import { moveToTrash } from '~/utils/trash'
import { Dialog } from '../dialog'

interface ConfirmDeleteDialogProps {
    entry: CompareEntry
    side: PanelSide
    leftDir: string
    rightDir: string
    dispatch: Dispatch<Action>
    refresh: () => void
    columns: number
    rows: number
}

export function ConfirmDeleteDialog({
    entry,
    side,
    leftDir,
    rightDir,
    dispatch,
    refresh,
    columns,
    rows,
}: ConfirmDeleteDialogProps) {
    const dir = side === 'left' ? leftDir : rightDir
    const fullPath = path.join(dir, entry.relativePath)
    const [selectedIndex, setSelectedIndex] = useState(1)

    const performDelete = () => {
        const trashPath = moveToTrash(fullPath)
        const undo: UndoEntry = {
            kind: 'delete',
            originalAbsPath: fullPath,
            side,
            trashPath,
            type: entry.type,
        }
        dispatch({ type: 'DELETE_COMPLETE', undo })
        refresh()
    }

    useInput((input, key) => {
        if (input === 'y') {
            performDelete()
            return
        }
        if (key.escape || input === 'n' || input === 'q') {
            dispatch({ type: 'CANCEL_DELETE' })
            return
        }
        if (input === 'j' || key.downArrow) {
            setSelectedIndex((i) => Math.min(i + 1, 1))
            return
        }
        if (input === 'k' || key.upArrow) {
            setSelectedIndex((i) => Math.max(i - 1, 0))
            return
        }
        if (key.return) {
            if (selectedIndex === 0) {
                performDelete()
            } else {
                dispatch({ type: 'CANCEL_DELETE' })
            }
        }
    })

    const options = [
        { label: 'Confirm', shortcut: 'y', color: theme.buttonConfirm },
        { label: 'Cancel', shortcut: 'n', color: theme.buttonCancel },
    ] as const

    return (
        <Dialog
            title='Delete'
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                <Text>
                    Delete{' '}
                    <Text
                        bold
                        color={theme.errorText}
                    >
                        {entry.name}
                    </Text>
                    {' from '}
                    <Text bold>{side}</Text>
                    {' panel?'}
                </Text>
                <Text dimColor>{fullPath}</Text>
            </Box>
            <Box
                flexDirection='column'
                alignItems='center'
            >
                {options.map((opt, i) => (
                    <Text key={opt.label}>
                        {i === selectedIndex ?
                            <Text
                                bold
                                inverse
                                color={opt.color}
                            >
                                {` ${opt.label} (${opt.shortcut}) `}
                            </Text>
                        :   <Text
                                dimColor
                            >{` ${opt.label} (${opt.shortcut}) `}</Text>
                        }
                    </Text>
                ))}
            </Box>
        </Dialog>
    )
}
