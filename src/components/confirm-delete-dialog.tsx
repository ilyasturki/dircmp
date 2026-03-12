import type { Dispatch } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { Box, Text, useInput } from 'ink'

import type { Action, CompareEntry, PanelSide } from '~/utils/types'
import { Dialog } from './dialog'

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

    useInput((input, key) => {
        if (input === 'y') {
            fs.rm(fullPath, { recursive: true, force: true }, () => {
                dispatch({ type: 'DELETE_COMPLETE' })
                refresh()
            })
            return
        }
        if (key.escape || input === 'n') {
            dispatch({ type: 'CANCEL_DELETE' })
        }
    })

    return (
        <Dialog
            title='Delete'
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                <Text>
                    Delete{' '}
                    <Text bold color='red'>
                        {entry.name}
                    </Text>
                    {' from '}
                    <Text bold>{side}</Text>
                    {' panel?'}
                </Text>
                <Text dimColor>{fullPath}</Text>
            </Box>
            <Text>
                <Text bold color='green'>
                    y
                </Text>
                {' confirm  '}
                <Text bold color='yellow'>
                    n/Esc
                </Text>
                {' cancel'}
            </Text>
        </Dialog>
    )
}
