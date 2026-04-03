import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action, CompareEntry } from '~/utils/types'
import {
    saveGlobalIgnorePatterns,
    savePairIgnorePattern,
} from '~/utils/ignore'
import { Dialog } from './dialog'

type Scope = 'pair' | 'global'

interface MenuItem {
    label: string
    scope: Scope
    pattern: string
    exists: boolean
}

interface QuickIgnoreDialogProps {
    entry: CompareEntry
    globalPatterns: string[]
    pairPatterns: string[]
    leftDir: string
    rightDir: string
    dispatch: Dispatch<Action>
    refresh: () => void
    columns: number
    rows: number
}

function buildItems(
    entry: CompareEntry,
    pairPatterns: string[],
    globalPatterns: string[],
): MenuItem[] {
    const all = [...pairPatterns, ...globalPatterns]
    const isRoot = entry.name === entry.relativePath

    if (isRoot) {
        return [
            {
                label: 'This comparison',
                scope: 'pair',
                pattern: entry.name,
                exists: all.includes(entry.name),
            },
            {
                label: 'Global',
                scope: 'global',
                pattern: entry.name,
                exists: all.includes(entry.name),
            },
        ]
    }

    return [
        {
            label: 'This comparison (path)',
            scope: 'pair',
            pattern: entry.relativePath,
            exists: all.includes(entry.relativePath),
        },
        {
            label: 'This comparison (name)',
            scope: 'pair',
            pattern: entry.name,
            exists: all.includes(entry.name),
        },
        {
            label: 'Global (path)',
            scope: 'global',
            pattern: entry.relativePath,
            exists: all.includes(entry.relativePath),
        },
        {
            label: 'Global (name)',
            scope: 'global',
            pattern: entry.name,
            exists: all.includes(entry.name),
        },
    ]
}

export function QuickIgnoreDialog({
    entry,
    globalPatterns,
    pairPatterns,
    leftDir,
    rightDir,
    dispatch,
    refresh,
    columns,
    rows,
}: QuickIgnoreDialogProps) {
    const items = buildItems(entry, pairPatterns, globalPatterns)
    const [selectedIndex, setSelectedIndex] = useState(0)

    const handleSelect = async (item: MenuItem) => {
        if (item.exists) {
            dispatch({ type: 'HIDE_QUICK_IGNORE' })
            return
        }

        if (item.scope === 'pair') {
            await savePairIgnorePattern(item.pattern, leftDir, rightDir)
            dispatch({ type: 'ADD_IGNORE_PATTERN', pattern: item.pattern })
        } else {
            await saveGlobalIgnorePatterns([...globalPatterns, item.pattern])
            dispatch({
                type: 'ADD_GLOBAL_IGNORE_PATTERN',
                pattern: item.pattern,
            })
        }

        refresh()
        dispatch({ type: 'HIDE_QUICK_IGNORE' })
    }

    useInput((input, key) => {
        if (key.escape || input === 'q' || input === 'i') {
            dispatch({ type: 'HIDE_QUICK_IGNORE' })
            return
        }

        if (input === 'j' || key.downArrow) {
            setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
            return
        }
        if (input === 'k' || key.upArrow) {
            setSelectedIndex((i) => Math.max(0, i - 1))
            return
        }

        if (key.return) {
            const item = items[selectedIndex]
            if (item) handleSelect(item)
            return
        }

        const num = Number.parseInt(input, 10)
        if (num >= 1 && num <= items.length) {
            const item = items[num - 1]
            if (item) handleSelect(item)
        }
    })

    return (
        <Dialog
            title={`Ignore: ${entry.name}`}
            columns={columns}
            rows={rows}
        >
            <Box flexDirection='column'>
                {items.map((item, i) => (
                    <Text key={`${item.scope}-${item.pattern}`}>
                        {i === selectedIndex ?
                            <Text
                                bold
                                color='cyan'
                            >
                                {'▸ '}
                            </Text>
                        :   <Text>{'  '}</Text>}
                        <Text
                            bold={i === selectedIndex}
                            dimColor={item.exists}
                        >
                            {item.label}
                        </Text>
                        <Text dimColor>{`  ${item.pattern}`}</Text>
                        {item.exists && <Text dimColor>{' (exists)'}</Text>}
                    </Text>
                ))}
            </Box>
            <Text dimColor>j/k navigate  Enter select  Esc close</Text>
        </Dialog>
    )
}
