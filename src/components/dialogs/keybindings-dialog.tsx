import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Shortcut } from '~/keymap'
import type { KeybindingOverrides } from '~/utils/keybindings'
import type { Action } from '~/utils/types'
import { useListNavigation } from '~/hooks'
import { groupByMode, MODE_LABELS } from '~/keymap'
import {
    formatKeyDef,
    loadKeybindings,
    saveKeybindings,
    validateKeyDef,
} from '~/utils/keybindings'
import { Dialog } from '../dialog'
import { InputField } from '../input-field'
import { KeyboardHints } from '../keyboard-hints'

type DisplayMode = 'browse' | 'edit'

interface KeybindingsDialogProps {
    defaults: Shortcut[]
    dispatch: Dispatch<Action>
    columns: number
    rows: number
}

function getEditableLabel(
    shortcut: Shortcut,
    overrides: KeybindingOverrides,
): string {
    const override = overrides[shortcut.id]
    if (override === undefined) return formatKeyDef(shortcut.keyDef)
    return formatKeyDef(override)
}

export function KeybindingsDialog({
    defaults,
    dispatch,
    columns,
    rows,
}: KeybindingsDialogProps) {
    const [displayMode, setDisplayMode] = useState<DisplayMode>('browse')
    const [editValue, setEditValue] = useState('')
    const [error, setError] = useState('')
    const [overrides, setOverrides] =
        useState<KeybindingOverrides>(loadKeybindings)

    const groups = groupByMode(defaults)
    const orderedDefaults: Shortcut[] = groups.flatMap((g) => g.items)

    // Dialog chrome: border (2) + paddingY (2) + title (1) + gap (1) + hints (1) + help text (1) = 8
    // Additional reserve: section header (1) + spacer (1) per group
    const maxRows = Math.max(1, rows - 12 - groups.length * 2)
    const needsScroll = orderedDefaults.length > maxRows
    const maxVisibleItems = needsScroll ? maxRows - 1 : maxRows

    const {
        selectedIndex,
        scrollOffset,
        scrollTo,
        handleInput: handleNav,
    } = useListNavigation({
        itemCount: orderedDefaults.length,
        maxVisibleItems,
    })

    const hasArrowUp = needsScroll && scrollOffset > 0
    const hasArrowDown =
        needsScroll && scrollOffset + maxVisibleItems < orderedDefaults.length

    const visibleItems = orderedDefaults.slice(
        scrollOffset,
        scrollOffset + maxVisibleItems,
    )

    const handleEditSubmit = async (input: string) => {
        const trimmed = input.trim()
        if (trimmed === '') {
            setDisplayMode('browse')
            setEditValue('')
            setError('')
            return
        }

        // Parse comma-separated values into array or single string
        const parts = trimmed
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        const keyDef = parts.length > 1 ? parts : trimmed

        const validationError = validateKeyDef(keyDef)
        if (validationError) {
            setError(validationError)
            return
        }

        const shortcut = orderedDefaults[selectedIndex]
        if (!shortcut) return

        const updated = { ...overrides, [shortcut.id]: keyDef }
        await saveKeybindings(updated)
        setOverrides(updated)
        dispatch({ type: 'KEYBINDINGS_UPDATED' })

        setDisplayMode('browse')
        setEditValue('')
        setError('')
    }

    const handleReset = async () => {
        const shortcut = orderedDefaults[selectedIndex]
        if (!shortcut) return
        if (!(shortcut.id in overrides)) return

        const updated = { ...overrides }
        delete updated[shortcut.id]
        await saveKeybindings(updated)
        setOverrides(updated)
        dispatch({ type: 'KEYBINDINGS_UPDATED' })
    }

    useInput((input, key) => {
        if (displayMode === 'browse') {
            if (key.escape || input === 'q') {
                dispatch({ type: 'HIDE_KEYBINDINGS_EDITOR' })
                return
            }

            if (handleNav(input, key)) return

            if (key.return) {
                const shortcut = orderedDefaults[selectedIndex]
                if (!shortcut) return
                setEditValue(getEditableLabel(shortcut, overrides))
                setError('')
                setDisplayMode('edit')
                return
            }
            if (input === 'd') {
                handleReset()
                return
            }
            return
        }

        // Edit mode: only handle escape (TextInput handles the rest)
        if (key.escape) {
            setDisplayMode('browse')
            setEditValue('')
            setError('')
        }
    })

    const maxDescWidth = Math.max(
        ...defaults.map((s) => s.helpDescription.length),
    )
    const maxKeyWidth = Math.max(
        ...defaults.map((s) => getEditableLabel(s, overrides).length),
    )
    // Each row: marker(1) + desc + gap(>=1) + key + trailing(1)
    const requiredContentWidth = 3 + maxDescWidth + maxKeyWidth
    const dialogWidth = Math.min(
        Math.max(55, requiredContentWidth + 6),
        columns - 4,
    )
    const contentWidth = dialogWidth - 6 // border (2) + paddingX (4)

    return (
        <Dialog
            title='Edit Keybindings'
            columns={columns}
            rows={rows}
            width={dialogWidth}
        >
            <Box flexDirection='column'>
                {hasArrowUp && (
                    <Text dimColor>
                        {'▲'.padStart(Math.ceil(contentWidth / 2))}
                    </Text>
                )}
                {visibleItems.map((shortcut, i) => {
                    const absoluteIndex = scrollOffset + i
                    const isSelected = absoluteIndex === selectedIndex
                    const isCustomized = shortcut.id in overrides
                    const currentKey = getEditableLabel(shortcut, overrides)
                    const prevShortcut =
                        absoluteIndex > 0 ?
                            orderedDefaults[absoluteIndex - 1]
                        :   undefined
                    const showHeader =
                        !prevShortcut || prevShortcut.mode !== shortcut.mode
                    const showSpacer = showHeader && i > 0

                    const header = showHeader && (
                        <>
                            {showSpacer && <Text> </Text>}
                            <Text
                                bold
                                italic
                            >
                                {MODE_LABELS[shortcut.mode]}
                            </Text>
                        </>
                    )

                    if (displayMode === 'edit' && isSelected) {
                        return (
                            <Box
                                key={shortcut.id}
                                flexDirection='column'
                            >
                                {header}
                                <InputField
                                    label={shortcut.helpDescription}
                                    value={editValue}
                                    onChange={(v) => {
                                        setEditValue(v)
                                        setError('')
                                    }}
                                    onSubmit={handleEditSubmit}
                                    error={error}
                                />
                            </Box>
                        )
                    }

                    const marker = isCustomized ? '*' : ' '
                    const desc = shortcut.helpDescription
                    const keyPart = currentKey
                    const gap = Math.max(
                        1,
                        contentWidth - maxDescWidth - keyPart.length - 2,
                    )

                    return (
                        <Box
                            key={shortcut.id}
                            flexDirection='column'
                        >
                            {header}
                            <Text inverse={isSelected}>
                                {marker}
                                {desc}
                                {' '.repeat(gap + (maxDescWidth - desc.length))}
                                <Text color='cyan'>{keyPart}</Text>{' '}
                            </Text>
                        </Box>
                    )
                })}
                {hasArrowDown && (
                    <Text dimColor>
                        {'▼'.padStart(Math.ceil(contentWidth / 2))}
                    </Text>
                )}
            </Box>
            {displayMode === 'edit' && (
                <Text dimColor>
                    Format: key, ctrl+key, sequence (gg), or comma-separated (k,
                    up)
                </Text>
            )}
            <KeyboardHints
                items={
                    displayMode === 'browse' ?
                        [
                            { key: '<enter>', label: 'edit' },
                            { key: 'd', label: 'reset' },
                            { key: 'esc', label: 'close' },
                        ]
                    :   [
                            { key: '<enter>', label: 'save' },
                            { key: 'esc', label: 'cancel' },
                        ]
                }
                columns={columns}
            />
        </Dialog>
    )
}
