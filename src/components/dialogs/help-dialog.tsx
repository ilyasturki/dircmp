import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { HelpItem, Shortcut } from '~/keymap'
import type { Action } from '~/utils/types'
import { useListNavigation } from '~/hooks'
import { getHelpItems, groupByMode, MODE_LABELS } from '~/keymap'
import { theme } from '~/utils/theme'
import { Dialog } from '../dialog'
import { TextInput } from '../text-input'

interface HelpDialogProps {
    keymap: Shortcut[]
    dispatch: Dispatch<Action>
    onExecuteAction: (action: Action) => void
    onExit: () => void
    columns: number
    rows: number
}

export function HelpDialog({
    keymap,
    dispatch,
    onExecuteAction,
    onExit,
    columns,
    rows,
}: HelpDialogProps) {
    const items = getHelpItems(keymap)
    const groupedAll = groupByMode(items)
    const orderedItems: HelpItem[] = groupedAll.flatMap((g) => g.items)
    const [searchActive, setSearchActive] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const filteredItems =
        searchQuery ?
            orderedItems.filter((item) => {
                const q = searchQuery.toLowerCase()
                return (
                    item.key.toLowerCase().includes(q)
                    || item.helpDescription.toLowerCase().includes(q)
                )
            })
        :   orderedItems

    const visibleGroups = groupByMode(filteredItems)

    // Reserve rows for dialog chrome (7) + header (1) + spacer (1) per group
    const maxVisibleItems = Math.min(
        orderedItems.length,
        Math.max(1, rows - 11 - visibleGroups.length * 2),
    )

    const {
        selectedIndex,
        scrollOffset,
        setSelectedIndex,
        setScrollOffset,
        handleInput: handleNav,
    } = useListNavigation({
        itemCount: filteredItems.length,
        maxVisibleItems,
    })

    const visibleItems = filteredItems.slice(
        scrollOffset,
        scrollOffset + maxVisibleItems,
    )

    function handleSearchChange(value: string) {
        setSearchQuery(value)
        setSelectedIndex(0)
        setScrollOffset(0)
    }

    useInput((input, key) => {
        if (searchActive) {
            if (key.escape) {
                setSearchActive(false)
                setSearchQuery('')
                setSelectedIndex(0)
                setScrollOffset(0)
            }
            if (key.return) {
                setSearchActive(false)
            }
            return
        }

        if (key.escape || input === '?' || input === 'q') {
            dispatch({ type: 'HIDE_HELP' })
            return
        }

        if (input === '/') {
            setSearchActive(true)
            return
        }

        if (handleNav(input, key)) return

        if (key.return) {
            const item = filteredItems[selectedIndex]
            if (!item) return
            dispatch({ type: 'HIDE_HELP' })
            if (item.effect.type === 'exit') {
                onExit()
            } else {
                onExecuteAction(item.effect.action)
            }
            return
        }
    })

    const maxKeyWidth = Math.max(...items.map((item) => item.key.length))
    // Dialog chrome: border (2) + paddingX (4) = 6 cols
    const dialogWidth = Math.min(50, columns - 4)
    const contentWidth = dialogWidth - 6

    return (
        <Dialog
            title='Keybindings'
            columns={columns}
            rows={rows}
            width={dialogWidth}
        >
            <Box flexDirection='column'>
                {searchActive ?
                    <Box>
                        <Text>
                            <Text color={theme.searchPrefix}>/</Text>
                            <TextInput
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onSubmit={() => setSearchActive(false)}
                                focus={true}
                            />
                        </Text>
                        <Text dimColor>
                            {' '}
                            {filteredItems.length}/{items.length}
                        </Text>
                    </Box>
                : searchQuery ?
                    <Text dimColor>
                        /{searchQuery} ({filteredItems.length}/{items.length})
                    </Text>
                :   <Text> </Text>}
                {filteredItems.length === 0 && searchQuery ?
                    <Text dimColor>No matches</Text>
                :   visibleItems.map((item, i) => {
                        const absoluteIndex = scrollOffset + i
                        const isSelected = absoluteIndex === selectedIndex
                        const keyPad = maxKeyWidth - item.key.length
                        const keyPart = ' '.repeat(keyPad) + item.key + ' '
                        const descPart = ` ${item.helpDescription}`
                        const usedWidth = maxKeyWidth + 1 + descPart.length
                        const pad = Math.max(0, contentWidth - usedWidth)
                        const prevItem =
                            absoluteIndex > 0 ?
                                filteredItems[absoluteIndex - 1]
                            :   undefined
                        const showHeader =
                            !prevItem || prevItem.mode !== item.mode
                        const showSpacer = showHeader && i > 0
                        return (
                            <Box
                                key={absoluteIndex}
                                flexDirection='column'
                            >
                                {showSpacer && <Text> </Text>}
                                {showHeader && (
                                    <Text
                                        bold
                                        italic
                                    >
                                        {MODE_LABELS[item.mode]}
                                    </Text>
                                )}
                                <Text inverse={isSelected}>
                                    <Text color={theme.keybindingKey}>
                                        {keyPart}
                                    </Text>
                                    {descPart}
                                    {' '.repeat(pad)}
                                </Text>
                            </Box>
                        )
                    })
                }
                {Array.from(
                    { length: maxVisibleItems - visibleItems.length },
                    (_, i) => (
                        <Text key={`pad-${i}`}> </Text>
                    ),
                )}
            </Box>
        </Dialog>
    )
}
