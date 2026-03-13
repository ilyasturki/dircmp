import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import { saveIgnorePattern } from '~/utils/ignore'
import { Dialog } from './dialog'

interface IgnoreDialogProps {
    patterns: string[]
    dispatch: Dispatch<Action>
    refresh: () => void
    columns: number
    rows: number
}

export function IgnoreDialog({
    patterns,
    dispatch,
    refresh,
    columns,
    rows,
}: IgnoreDialogProps) {
    const [value, setValue] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (input: string) => {
        const pattern = input.trim()
        if (pattern === '') return
        if (patterns.includes(pattern)) {
            setError(`Pattern "${pattern}" already exists`)
            return
        }
        await saveIgnorePattern(pattern)
        dispatch({ type: 'ADD_IGNORE_PATTERN', pattern })
        refresh()
    }

    useInput((_input, key) => {
        if (key.escape) {
            dispatch({ type: 'HIDE_IGNORE_DIALOG' })
        }
    })

    return (
        <Dialog
            title='Add Ignore Pattern'
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                <Text>
                    <Text bold>Pattern: </Text>
                    <TextInput
                        value={value}
                        onChange={(v) => {
                            setValue(v)
                            setError('')
                        }}
                        onSubmit={handleSubmit}
                        focus
                    />
                </Text>
                {error && <Text color='red'>{error}</Text>}
                {patterns.length > 0 && (
                    <Box
                        flexDirection='column'
                        marginTop={1}
                    >
                        <Text dimColor>Current patterns:</Text>
                        {patterns.map((p) => (
                            <Text
                                key={p}
                                dimColor
                            >
                                {'  '}
                                {p}
                            </Text>
                        ))}
                    </Box>
                )}
            </Box>
        </Dialog>
    )
}
