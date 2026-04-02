import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import { saveIgnorePattern, saveIgnorePatterns } from '~/utils/ignore'
import { Dialog } from './dialog'
import { InputField } from './input-field'
import { KeyboardHints } from './keyboard-hints'

type DisplayMode = 'browse' | 'edit'

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
    const [displayMode, setDisplayMode] = useState<DisplayMode>('browse')
    const [isAdding, setIsAdding] = useState(false)
    const [editValue, setEditValue] = useState('')
    const [error, setError] = useState('')

    const handleEditSubmit = async (input: string) => {
        const newPattern = input.trim()
        if (newPattern === '') return

        if (isAdding) {
            if (patterns.includes(newPattern)) {
                setError(`Pattern "${newPattern}" already exists`)
                return
            }
            await saveIgnorePattern(newPattern)
            dispatch({ type: 'ADD_IGNORE_PATTERN', pattern: newPattern })
            refresh()
            setEditValue('')
            setError('')
            setIsAdding(false)
            setDisplayMode('browse')
            setSelectedIndex(patterns.length)
            return
        }

        const oldPattern = patterns[selectedIndex]
        if (!oldPattern) return
        if (newPattern === oldPattern) {
            setDisplayMode('browse')
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
        setDisplayMode('browse')
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

    const handleInputChange = (v: string) => {
        setEditValue(v)
        setError('')
    }

    useInput((input, key) => {
        if (displayMode === 'browse') {
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
                    setDisplayMode('edit')
                    return
                }
            }
            if (input === 'a') {
                setSelectedIndex(patterns.length)
                setEditValue('')
                setError('')
                setIsAdding(true)
                setDisplayMode('edit')
                return
            }
            return
        }

        // add/edit mode: only handle escape (TextInput handles the rest)
        if (key.escape) {
            setDisplayMode('browse')
            setEditValue('')
            setError('')
            setIsAdding(false)
        }
    })

    return (
        <Dialog
            title='Ignore Patterns'
            columns={columns}
            rows={rows}
            width={40}
        >
            <Box flexDirection='column'>
                {patterns.length === 0
                    && !isAdding
                    && displayMode === 'browse' && (
                        <Text dimColor>No patterns defined</Text>
                    )}
                <Box flexDirection='column'>
                    {patterns.map((p, i) =>
                        (
                            displayMode === 'edit'
                            && !isAdding
                            && i === selectedIndex
                        ) ?
                            <InputField
                                key={p}
                                label='Edit'
                                value={editValue}
                                onChange={handleInputChange}
                                onSubmit={handleEditSubmit}
                                error={error}
                            />
                        :   <Text key={p}>
                                {(
                                    displayMode === 'browse'
                                    && i === selectedIndex
                                ) ?
                                    <Text
                                        bold
                                        color='cyan'
                                    >
                                        {'▸ '}
                                    </Text>
                                :   <Text>{'  '}</Text>}
                                <Text
                                    bold={
                                        displayMode === 'browse'
                                        && i === selectedIndex
                                    }
                                >
                                    {p}
                                </Text>
                            </Text>,
                    )}
                    {isAdding && (
                        <InputField
                            label='Add'
                            value={editValue}
                            onChange={handleInputChange}
                            onSubmit={handleEditSubmit}
                            error={error}
                        />
                    )}
                </Box>
            </Box>
            <KeyboardHints
                items={
                    displayMode === 'browse' ?
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
