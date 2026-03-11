import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useState } from 'react'

import type { AppConfig } from '~/utils/config'
import type { Action } from '~/utils/types'
import { saveConfig } from '~/utils/config'
import { Dialog } from './dialog'

interface PreferencesDialogProps {
    config: AppConfig
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

export function PreferencesDialog({
    config,
    dispatch,
    columns,
    rows,
}: PreferencesDialogProps) {
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = (value: string) => {
        const trimmed = value.trim()
        const newLocale = trimmed === '' ? undefined : trimmed

        if (newLocale !== undefined) {
            try {
                new Intl.DateTimeFormat(newLocale)
            } catch {
                setError(`Invalid locale: "${trimmed}"`)
                return
            }
        }

        const newConfig = { ...config, dateLocale: newLocale }
        dispatch({ type: 'UPDATE_CONFIG', config: newConfig })
        saveConfig(newConfig)
        setEditing(false)
        setError('')
    }

    useInput((input, key) => {
        if (editing) {
            if (key.escape) {
                setEditing(false)
                setError('')
            }
            return
        }

        if (key.escape || input === ',') {
            dispatch({ type: 'TOGGLE_PREFERENCES' })
            return
        }
        if (key.return) {
            setEditing(true)
            setEditValue(config.dateLocale ?? '')
            setError('')
        }
    })

    const displayValue = config.dateLocale ?? '(system default)'

    return (
        <Dialog
            title='Preferences'
            columns={columns}
            rows={rows}
        >
            {editing ?
                <Box flexDirection='column'>
                    <Text>
                        <Text bold>Date locale: </Text>
                        <TextInput
                            value={editValue}
                            onChange={(value) => {
                                setEditValue(value)
                                setError('')
                            }}
                            onSubmit={handleSubmit}
                            focus={editing}
                        />
                    </Text>
                    {error && <Text color='red'>{error}</Text>}
                </Box>
            :   <Box flexDirection='column'>
                    <Text>
                        <Text
                            bold
                            inverse
                        >
                            {' '}
                            Date locale{' '}
                        </Text>
                        <Text> {displayValue}</Text>
                    </Text>
                </Box>
            }
        </Dialog>
    )
}
