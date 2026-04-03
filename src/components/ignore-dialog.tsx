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
    const [addingSection, setAddingSection] = useState<
        'pair' | 'global' | null
    >(null)
    const [editValue, setEditValue] = useState('')
    const [error, setError] = useState('')

    const totalLength = pairPatterns.length + globalPatterns.length
    const inGlobalSection = selectedIndex >= pairPatterns.length
    const globalIndex = selectedIndex - pairPatterns.length
    const allPatterns = [...pairPatterns, ...globalPatterns]

    const handleEditSubmit = async (input: string) => {
        const newPattern = input.trim()
        if (newPattern === '') return

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
            setSelectedIndex(pairPatterns.length + globalPatterns.length)
            return
        }

        // Editing existing pattern
        if (inGlobalSection) {
            const oldPattern = globalPatterns[globalIndex]
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
            const updated = globalPatterns.map((p) =>
                p === oldPattern ? newPattern : p,
            )
            await saveGlobalIgnorePatterns(updated)
            dispatch({
                type: 'UPDATE_GLOBAL_IGNORE_PATTERN',
                oldPattern,
                newPattern,
            })
            refresh()
        } else {
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
        }
        setEditValue('')
        setError('')
        setDisplayMode('browse')
    }

    const handleDelete = async () => {
        if (inGlobalSection) {
            const pattern = globalPatterns[globalIndex]
            if (!pattern) return
            const remaining = globalPatterns.filter((p) => p !== pattern)
            await saveGlobalIgnorePatterns(remaining)
            dispatch({ type: 'REMOVE_GLOBAL_IGNORE_PATTERN', pattern })
            refresh()
            setSelectedIndex(
                Math.min(
                    selectedIndex,
                    Math.max(
                        0,
                        pairPatterns.length + remaining.length - 1,
                    ),
                ),
            )
        } else {
            const pattern = pairPatterns[selectedIndex]
            if (!pattern) return
            const remaining = pairPatterns.filter((p) => p !== pattern)
            await savePairIgnorePatterns(remaining, leftDir, rightDir)
            dispatch({ type: 'REMOVE_IGNORE_PATTERN', pattern })
            refresh()
            setSelectedIndex(
                Math.min(
                    selectedIndex,
                    Math.max(0, remaining.length + globalPatterns.length - 1),
                ),
            )
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
            if (totalLength > 0) {
                if (input === 'j' || key.downArrow) {
                    setSelectedIndex((i) =>
                        Math.min(totalLength - 1, i + 1),
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
                    const pattern = inGlobalSection
                        ? globalPatterns[globalIndex]
                        : pairPatterns[selectedIndex]
                    setEditValue(pattern ?? '')
                    setError('')
                    setDisplayMode('edit')
                    return
                }
            }
            if (input === 'a') {
                const section = inGlobalSection ? 'global' : 'pair'
                const insertIndex =
                    section === 'global'
                        ? pairPatterns.length + globalPatterns.length
                        : pairPatterns.length
                setSelectedIndex(insertIndex)
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

    const renderPatternList = (
        patterns: string[],
        indexOffset: number,
        isEditing: boolean,
    ) =>
        patterns.map((p, i) => {
            const flatIndex = indexOffset + i
            if (
                displayMode === 'edit'
                && !addingSection
                && flatIndex === selectedIndex
            ) {
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
                <Text key={p}>
                    {displayMode === 'browse' && flatIndex === selectedIndex ?
                        <Text bold color='cyan'>
                            {'▸ '}
                        </Text>
                    :   <Text>{'  '}</Text>}
                    <Text
                        bold={
                            displayMode === 'browse'
                            && flatIndex === selectedIndex
                        }
                    >
                        {p}
                    </Text>
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
                    <Text dimColor bold>
                        This comparison:
                    </Text>
                    {pairPatterns.length === 0
                        && addingSection !== 'pair'
                        && displayMode === 'browse' && (
                            <Text dimColor>{'  '}No patterns defined</Text>
                        )}
                    {renderPatternList(pairPatterns, 0, true)}
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
                <Box flexDirection='column'>
                    <Text dimColor bold>
                        Global:
                    </Text>
                    {globalPatterns.length === 0
                        && addingSection !== 'global'
                        && displayMode === 'browse' && (
                            <Text dimColor>{'  '}No patterns defined</Text>
                        )}
                    {renderPatternList(
                        globalPatterns,
                        pairPatterns.length,
                        true,
                    )}
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
