import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { AppConfig } from '~/utils/config'
import type { Action } from '~/utils/types'
import { defaultConfig, saveConfig } from '~/utils/config'
import { Dialog } from './dialog'
import { InputField } from './input-field'

interface PreferencesDialogProps {
    config: AppConfig
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

type Field = 'dateLocale' | 'showHints' | 'compareDates' | 'diffCommand'
const fields: Field[] = [
    'dateLocale',
    'showHints',
    'compareDates',
    'diffCommand',
]

const fieldHints: Partial<Record<Field, string>> = {
    dateLocale: 'e.g. en-US, de-DE, ja-JP',
    diffCommand: 'e.g. nvim -d, vimdiff, delta',
}

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

    const handleSubmitDiffCommand = (value: string) => {
        const trimmed = value.trim()
        const newDiffCommand = trimmed === '' ? undefined : trimmed
        const newConfig = { ...config, diffCommand: newDiffCommand }
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

    const toggleCompareDates = () => {
        const newConfig = { ...config, compareDates: !config.compareDates }
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

        if (input === 'd' && isModified(focusedField)) {
            resetField(focusedField)
            return
        }

        if (
            key.return
            || (input === ' '
                && (focusedField === 'showHints'
                    || focusedField === 'compareDates'))
        ) {
            if (focusedField === 'dateLocale' && key.return) {
                setEditing(true)
                setEditValue(config.dateLocale ?? '')
                setError('')
            } else if (focusedField === 'showHints') {
                toggleShowHints()
            } else if (focusedField === 'compareDates') {
                toggleCompareDates()
            } else if (focusedField === 'diffCommand' && key.return) {
                setEditing(true)
                setEditValue(config.diffCommand ?? '')
                setError('')
            }
        }
    })

    const isModified = (field: Field) => config[field] !== defaultConfig[field]

    const resetField = (field: Field) => {
        const newConfig = {
            ...config,
            [field]: defaultConfig[field],
        }
        dispatch({ type: 'UPDATE_CONFIG', config: newConfig })
        saveConfig(newConfig)
    }

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
                hint={fieldHints.dateLocale}
                modified={isModified('dateLocale')}
            />
            <Box justifyContent='space-between'>
                <Text>
                    {isModified('showHints') ? '*' : ' '}
                    <Text
                        bold={focusedField === 'showHints'}
                        inverse={focusedField === 'showHints'}
                    >
                        {' '}
                        Show help hints{' '}
                    </Text>
                </Text>
                <Text>{config.showHints ? 'yes' : 'no'}</Text>
            </Box>
            <Box justifyContent='space-between'>
                <Text>
                    {isModified('compareDates') ? '*' : ' '}
                    <Text
                        bold={focusedField === 'compareDates'}
                        inverse={focusedField === 'compareDates'}
                    >
                        {' '}
                        Compare dates{' '}
                    </Text>
                </Text>
                <Text>{config.compareDates ? 'yes' : 'no'}</Text>
            </Box>
            <InputField
                label='Diff command'
                editing={editing && focusedField === 'diffCommand'}
                highlighted={focusedField === 'diffCommand'}
                value={editValue}
                onChange={(value) => {
                    setEditValue(value)
                    setError('')
                }}
                onSubmit={handleSubmitDiffCommand}
                focus={editing && focusedField === 'diffCommand'}
                error={error}
                displayValue={config.diffCommand ?? '(built-in)'}
                hint={fieldHints.diffCommand}
                modified={isModified('diffCommand')}
            />
        </Dialog>
    )
}
