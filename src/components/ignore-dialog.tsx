import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import { savePairIgnorePattern, savePairIgnorePatterns } from '~/utils/ignore'
import { Dialog } from './dialog'
import { InputField } from './input-field'
import { KeyboardHints } from './keyboard-hints'

type DisplayMode = 'browse' | 'edit'

interface IgnoreDialogProps {
    globalPatterns: string[]
    pairPatterns: string[]
    leftDir: string
    rightDir: string
    dispatch: Dispatch<Action>
    refresh: () => void
    columns: number
    rows: number
}

export function IgnoreDialog({
    globalPatterns,
    pairPatterns,
    leftDir,
    rightDir,
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

    const allPatterns = [...globalPatterns, ...pairPatterns]

    const handleEditSubmit = async (input: string) => {
        const newPattern = input.trim()
        if (newPattern === '') return

        if (isAdding) {
            if (allPatterns.includes(newPattern)) {
                setError(`Pattern "${newPattern}" already exists`)
                return
            }
            await savePairIgnorePattern(newPattern, leftDir, rightDir)
            dispatch({ type: 'ADD_IGNORE_PATTERN', pattern: newPattern })
            refresh()
            setEditValue('')
            setError('')
            setIsAdding(false)
            setDisplayMode('browse')
            setSelectedIndex(pairPatterns.length)
            return
        }

        const oldPattern = pairPatterns[selectedIndex]
        if (!oldPattern) return
        if (newPattern === oldPattern) {
            setDisplayMode('browse')
            setError('')
            return
        }
        if (allPatterns.includes(newPattern)) {
            setError(`Pattern "${newPattern}" already exists`)
            return
        }
        const updated = pairPatterns.map((p) =>
            p === oldPattern ? newPattern : p,
        )
        await savePairIgnorePatterns(updated, leftDir, rightDir)
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
        const pattern = pairPatterns[selectedIndex]
        if (!pattern) return
        const remaining = pairPatterns.filter((p) => p !== pattern)
        await savePairIgnorePatterns(remaining, leftDir, rightDir)
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
            if (pairPatterns.length > 0) {
                if (input === 'j' || key.downArrow) {
                    setSelectedIndex((i) =>
                        Math.min(pairPatterns.length - 1, i + 1),
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
                    setEditValue(pairPatterns[selectedIndex] ?? '')
                    setError('')
                    setDisplayMode('edit')
                    return
                }
            }
            if (input === 'a') {
                setSelectedIndex(pairPatterns.length)
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
                {globalPatterns.length > 0 && (
                    <Box flexDirection='column'>
                        <Text dimColor bold>
                            Global:
                        </Text>
                        {globalPatterns.map((p) => (
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
                <Box flexDirection='column'>
                    <Text
                        dimColor
                        bold
                    >
                        This comparison:
                    </Text>
                    {pairPatterns.length === 0
                        && !isAdding
                        && displayMode === 'browse' && (
                            <Text dimColor>{'  '}No patterns defined</Text>
                        )}
                    {pairPatterns.map((p, i) =>
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
            <Text dimColor>Uses .gitignore syntax</Text>
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
