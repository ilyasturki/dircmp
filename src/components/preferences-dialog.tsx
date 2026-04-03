import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { AppConfig } from '~/utils/config'
import type { Action } from '~/utils/types'
import { saveConfig } from '~/utils/config'
import { Dialog } from './dialog'
import { InputField } from './input-field'

interface PreferencesDialogProps {
    config: AppConfig
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

type Field = 'dateLocale' | 'showHints'
const fields: Field[] = ['dateLocale', 'showHints']

export function PreferencesDialog({
    config,
    dispatch,
    columns,
    rows,
}: PreferencesDialogProps) {
    const [focusedField, setFocusedField] = useState<Field>('dateLocale')
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState('')
    const [error, setError] = useState('')

    const handleSubmitLocale = (value: string) => {
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

    const toggleShowHints = () => {
        const newConfig = { ...config, showHints: !config.showHints }
        dispatch({ type: 'UPDATE_CONFIG', config: newConfig })
        saveConfig(newConfig)
    }

    useInput((input, key) => {
        if (editing) {
            if (key.escape) {
                setEditing(false)
                setError('')
            }
            return
        }

        if (key.escape || input === ',' || input === 'q') {
            dispatch({ type: 'TOGGLE_PREFERENCES' })
            return
        }

        if (key.upArrow || input === 'k') {
            const idx = fields.indexOf(focusedField)
            if (idx > 0) setFocusedField(fields[idx - 1])
            return
        }
        if (key.downArrow || input === 'j') {
            const idx = fields.indexOf(focusedField)
            if (idx < fields.length - 1) setFocusedField(fields[idx + 1])
            return
        }

        if (key.return || (input === ' ' && focusedField === 'showHints')) {
            if (focusedField === 'dateLocale' && key.return) {
                setEditing(true)
                setEditValue(config.dateLocale ?? '')
                setError('')
            } else if (focusedField === 'showHints') {
                toggleShowHints()
            }
        }
    })

    const localeDisplayValue = config.dateLocale ?? '(system default)'

    return (
        <Dialog
            title='Preferences'
            columns={columns}
            rows={rows}
            width={40}
        >
            <InputField
                label='Date locale'
                editing={editing && focusedField === 'dateLocale'}
                highlighted={focusedField === 'dateLocale'}
                value={editValue}
                onChange={(value) => {
                    setEditValue(value)
                    setError('')
                }}
                onSubmit={handleSubmitLocale}
                focus={editing && focusedField === 'dateLocale'}
                error={error}
                displayValue={localeDisplayValue}
            />
            <Box>
                <Text>
                    <Text
                        bold={focusedField === 'showHints'}
                        inverse={focusedField === 'showHints'}
                    >
                        {' '}
                        Show help hints{' '}
                    </Text>
                    <Text> {config.showHints ? 'yes' : 'no'}</Text>
                </Text>
            </Box>
        </Dialog>
    )
}
