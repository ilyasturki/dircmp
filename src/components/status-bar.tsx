import { Box, Text } from 'ink'

import type { Shortcut } from '~/keymap'
import type { FilterMode } from '~/utils/types'

interface StatusBarProps {
    isLoading: boolean
    keymap: Shortcut[]
    filterMode: FilterMode
}

export function StatusBar({ isLoading, keymap, filterMode }: StatusBarProps) {
    if (isLoading) {
        return (
            <Box>
                <Text color='yellow'>Scanning directories...</Text>
            </Box>
        )
    }

    const filterLabel = filterMode === 'all' ? '[all]' : '[diff only]'

    const helpText = keymap
        .filter((s) => s.keyLabel !== '')
        .map((s) => `${s.keyLabel}: ${s.description}`)
        .join(' | ')

    return (
        <Box>
            <Text color='cyan'>{filterLabel} </Text>
            <Text dimColor>{helpText}</Text>
        </Box>
    )
}
