import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import {
    saveGlobalIgnorePatterns,
    savePairIgnorePattern,
    savePairIgnorePatterns,
} from '~/utils/ignore'
import { Dialog } from './dialog'
import { InputField } from './input-field'
import { KeyboardHints } from './keyboard-hints'

type DisplayMode = 'browse' | 'edit'
type Section = 'pair' | 'global'

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
    const [section, setSection] = useState<Section>('pair')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [displayMode, setDisplayMode] = useState<DisplayMode>('browse')
    const [addingSection, setAddingSection] = useState<Section | null>(null)
    const [editValue, setEditValue] = useState('')
    const [error, setError] = useState('')

    const patterns = section === 'pair' ? pairPatterns : globalPatterns
    const allPatterns = [...pairPatterns, ...globalPatterns]

    const navigate = (direction: 'up' | 'down') => {
        if (direction === 'down') {
            if (selectedIndex < patterns.length - 1) {
                setSelectedIndex((i) => i + 1)
            } else if (section === 'pair') {
                setSection('global')
                setSelectedIndex(0)
            }
        } else {
            if (selectedIndex > 0) {
                setSelectedIndex((i) => i - 1)
            } else if (section === 'global') {
                setSection('pair')
                setSelectedIndex(Math.max(0, pairPatterns.length - 1))
            }
        }
    }

    const handleEditSubmit = async (input: string) => {
        const newPattern = input.trim()
        if (newPattern === '') {
            setDisplayMode('browse')
            setEditValue('')
            setError('')
            setAddingSection(null)
            return
        }

        if (addingSection === 'pair') {
            if (allPatterns.includes(newPattern)) {
                setError(`Pattern "${newPattern}" already exists`)
                return
            }
            await savePairIgnorePattern(newPattern, leftDir, rightDir)
            dispatch({ type: 'ADD_IGNORE_PATTERN', pattern: newPattern })
            refresh()
            setEditValue('')
            setError('')
            setAddingSection(null)
            setDisplayMode('browse')
            setSection('pair')
            setSelectedIndex(pairPatterns.length)
            return
        }

        if (addingSection === 'global') {
            if (allPatterns.includes(newPattern)) {
                setError(`Pattern "${newPattern}" already exists`)
                return
            }
            await saveGlobalIgnorePatterns([...globalPatterns, newPattern])
            dispatch({
                type: 'ADD_GLOBAL_IGNORE_PATTERN',
                pattern: newPattern,
            })
            refresh()
            setEditValue('')
            setError('')
            setAddingSection(null)
            setDisplayMode('browse')
            setSection('global')
            setSelectedIndex(globalPatterns.length)
            return
        }

        // Editing existing pattern
        const oldPattern = patterns[selectedIndex]
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
        if (section === 'global') {
            const updated = globalPatterns.map((p) =>
                p === oldPattern ? newPattern : p,
            )
            await saveGlobalIgnorePatterns(updated)
            dispatch({
                type: 'UPDATE_GLOBAL_IGNORE_PATTERN',
                oldPattern,
                newPattern,
            })
        } else {
            const updated = pairPatterns.map((p) =>
                p === oldPattern ? newPattern : p,
            )
            await savePairIgnorePatterns(updated, leftDir, rightDir)
            dispatch({
                type: 'UPDATE_IGNORE_PATTERN',
                oldPattern,
                newPattern,
            })
        }
        refresh()
        setEditValue('')
        setError('')
        setDisplayMode('browse')
    }

    const handleDelete = async () => {
        const pattern = patterns[selectedIndex]
        if (!pattern) return
        if (section === 'global') {
            const remaining = globalPatterns.filter((p) => p !== pattern)
            await saveGlobalIgnorePatterns(remaining)
            dispatch({ type: 'REMOVE_GLOBAL_IGNORE_PATTERN', pattern })
            refresh()
            if (remaining.length === 0) {
                setSection('pair')
                setSelectedIndex(Math.max(0, pairPatterns.length - 1))
            } else {
                setSelectedIndex(Math.min(selectedIndex, remaining.length - 1))
            }
        } else {
            const remaining = pairPatterns.filter((p) => p !== pattern)
            await savePairIgnorePatterns(remaining, leftDir, rightDir)
            dispatch({ type: 'REMOVE_IGNORE_PATTERN', pattern })
            refresh()
            if (remaining.length === 0 && globalPatterns.length > 0) {
                setSection('global')
                setSelectedIndex(0)
            } else {
                setSelectedIndex(
                    Math.min(selectedIndex, Math.max(0, remaining.length - 1)),
                )
            }
        }
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
            if (input === 'j' || key.downArrow) {
                navigate('down')
                return
            }
            if (input === 'k' || key.upArrow) {
                navigate('up')
                return
            }
            if (patterns.length > 0) {
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
            if (input === 'a' || (key.return && patterns.length === 0)) {
                setEditValue('')
                setError('')
                setAddingSection(section)
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
            setAddingSection(null)
        }
    })

    const renderPatternList = (listPatterns: string[], listSection: Section) =>
        listPatterns.map((p, i) => {
            const isSelected = section === listSection && i === selectedIndex
            if (displayMode === 'edit' && !addingSection && isSelected) {
                return (
                    <InputField
                        key={p}
                        label='Edit'
                        value={editValue}
                        onChange={handleInputChange}
                        onSubmit={handleEditSubmit}
                        error={error}
                    />
                )
            }
            return (
                <Text
                    key={p}
                    bold={displayMode === 'browse' && isSelected}
                    inverse={displayMode === 'browse' && isSelected}
                >
                    {' '}{p}{' '}
                </Text>
            )
        })

    return (
        <Dialog
            title='Ignore Patterns'
            columns={columns}
            rows={rows}
            width={40}
        >
            <Box flexDirection='column'>
                <Box flexDirection='column'>
                    <Text
                        dimColor
                        bold
                    >
                        This comparison:
                    </Text>
                    {pairPatterns.length === 0
                        && addingSection !== 'pair'
                        && displayMode === 'browse' && (
                            <Text
                                dimColor={section !== 'pair'}
                                inverse={section === 'pair'}
                            >
                                {' '}No patterns defined{' '}
                            </Text>
                        )}
                    {renderPatternList(pairPatterns, 'pair')}
                    {addingSection === 'pair' && (
                        <InputField
                            label='Add'
                            value={editValue}
                            onChange={handleInputChange}
                            onSubmit={handleEditSubmit}
                            error={error}
                        />
                    )}
                </Box>
                <Text>{' '}</Text>
                <Box flexDirection='column'>
                    <Text
                        dimColor
                        bold
                    >
                        Global:
                    </Text>
                    {globalPatterns.length === 0
                        && addingSection !== 'global'
                        && displayMode === 'browse' && (
                            <Text
                                dimColor={section !== 'global'}
                                inverse={section === 'global'}
                            >
                                {' '}No patterns defined{' '}
                            </Text>
                        )}
                    {renderPatternList(globalPatterns, 'global')}
                    {addingSection === 'global' && (
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
