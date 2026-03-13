import { Box, Text } from 'ink'

import type { Shortcut } from '~/keymap'
import type { FilterMode } from '~/utils/types'
import { KeyboardHints } from './keyboard-hints'

interface StatusBarProps {
    isLoading: boolean
    keymap: Shortcut[]
    filterMode: FilterMode
    ignoreEnabled: boolean
}

export function StatusBar({
    isLoading,
    keymap,
    filterMode,
    ignoreEnabled,
}: StatusBarProps) {
    if (isLoading) {
        return (
            <Box>
                <Text color='yellow'>Scanning directories...</Text>
            </Box>
        )
    }

    const filterLabel = filterMode === 'all' ? '[all]' : '[diff only]'

    const helpItems = keymap
        .filter((s) => s.keyLabel !== '')
        .map((s) => ({ key: s.keyLabel, label: s.description }))

    return (
        <Box>
            <Text color='cyan'>{filterLabel} </Text>
            {ignoreEnabled && <Text color='cyan'>[ignore] </Text>}
            <KeyboardHints items={helpItems} />
        </Box>
    )
}
