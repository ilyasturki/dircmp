import type { Dispatch } from 'react'
import { Text, useInput } from 'ink'
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

        if (key.escape || input === ',' || input === 'q') {
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
            <InputField
                label='Date locale'
                editing={editing}
                value={editValue}
                onChange={(value) => {
                    setEditValue(value)
                    setError('')
                }}
                onSubmit={handleSubmit}
                focus={editing}
                error={error}
                displayValue={displayValue}
            />
        </Dialog>
    )
}
