import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import { saveIgnorePattern, saveIgnorePatterns } from '~/utils/ignore'
import { Dialog } from './dialog'
import { InputField } from './input-field'
import { KeyboardHints } from './keyboard-hints'

type Mode = 'browse' | 'add' | 'edit'

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
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [mode, setMode] = useState<Mode>('browse')
    const [editValue, setEditValue] = useState('')
    const [error, setError] = useState('')

    const handleAddSubmit = async (input: string) => {
        const pattern = input.trim()
        if (pattern === '') return
        if (patterns.includes(pattern)) {
            setError(`Pattern "${pattern}" already exists`)
            return
        }
        await saveIgnorePattern(pattern)
        dispatch({ type: 'ADD_IGNORE_PATTERN', pattern })
        refresh()
        setEditValue('')
        setError('')
        setMode('browse')
        setSelectedIndex(patterns.length)
    }

    const handleEditSubmit = async (input: string) => {
        const newPattern = input.trim()
        if (newPattern === '') return
        const oldPattern = patterns[selectedIndex]
        if (!oldPattern) return
        if (newPattern === oldPattern) {
            setMode('browse')
            setError('')
            return
        }
        if (patterns.includes(newPattern)) {
            setError(`Pattern "${newPattern}" already exists`)
            return
        }
        const updated = patterns.map((p) => (p === oldPattern ? newPattern : p))
        await saveIgnorePatterns(updated)
        dispatch({
            type: 'UPDATE_IGNORE_PATTERN',
            oldPattern,
            newPattern,
        })
        refresh()
        setEditValue('')
        setError('')
        setMode('browse')
    }

    const handleDelete = async () => {
        const pattern = patterns[selectedIndex]
        if (!pattern) return
        const remaining = patterns.filter((p) => p !== pattern)
        await saveIgnorePatterns(remaining)
        dispatch({ type: 'REMOVE_IGNORE_PATTERN', pattern })
        refresh()
        setSelectedIndex(
            Math.min(selectedIndex, Math.max(0, remaining.length - 1)),
        )
    }

    useInput((input, key) => {
        if (mode === 'browse') {
            if (key.escape || input === 'q') {
                dispatch({ type: 'HIDE_IGNORE_DIALOG' })
                return
            }
            if (patterns.length > 0) {
                if (input === 'j' || key.downArrow) {
                    setSelectedIndex((i) =>
                        Math.min(patterns.length - 1, i + 1),
                    )
                    return
                }
                if (input === 'k' || key.upArrow) {
                    setSelectedIndex((i) => Math.max(0, i - 1))
                    return
                }
                if (input === 'd') {
                    handleDelete()
                    return
                }
                if (key.return) {
                    setEditValue(patterns[selectedIndex] ?? '')
                    setError('')
                    setMode('edit')
                    return
                }
            }
            if (input === 'a') {
                setEditValue('')
                setError('')
                setMode('add')
                return
            }
            return
        }

        // add/edit mode: only handle escape (TextInput handles the rest)
        if (key.escape) {
            setMode('browse')
            setEditValue('')
            setError('')
        }
    })

    return (
        <Dialog
            title='Ignore Patterns'
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                {patterns.length === 0 && mode === 'browse' && (
                    <Text dimColor>No patterns defined</Text>
                )}
                {patterns.length > 0 && (
                    <Box flexDirection='column'>
                        {patterns.map((p, i) => (
                            <Text key={p}>
                                {mode === 'browse' && i === selectedIndex ?
                                    <Text
                                        bold
                                        color='cyan'
                                    >
                                        {'▸ '}
                                    </Text>
                                :   <Text>{'  '}</Text>}
                                <Text
                                    bold={
                                        mode === 'browse' && i === selectedIndex
                                    }
                                >
                                    {p}
                                </Text>
                            </Text>
                        ))}
                    </Box>
                )}
                {mode === 'edit' && (
                    <InputField
                        label='Edit'
                        value={editValue}
                        onChange={(v) => {
                            setEditValue(v)
                            setError('')
                        }}
                        onSubmit={handleEditSubmit}
                        error={error}
                    />
                )}
                {mode === 'add' && (
                    <InputField
                        label='Add'
                        value={editValue}
                        onChange={(v) => {
                            setEditValue(v)
                            setError('')
                        }}
                        onSubmit={handleAddSubmit}
                        error={error}
                    />
                )}
            </Box>
            <KeyboardHints
                items={
                    mode === 'browse' ?
                        [
                            { key: 'a', label: 'add' },
                            { key: 'd', label: 'delete' },
                            { key: '<enter>', label: 'edit' },
                            { key: 'esc', label: 'close' },
                        ]
                    :   [
                            { key: '<enter>', label: 'save' },
                            { key: 'esc', label: 'cancel' },
                        ]
                }
            />
        </Dialog>
    )
}
