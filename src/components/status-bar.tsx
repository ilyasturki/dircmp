import { Box, Text } from 'ink'

import type { Shortcut } from '~/keymap'

interface StatusBarProps {
    isLoading: boolean
    keymap: Shortcut[]
}

export function StatusBar({ isLoading, keymap }: StatusBarProps) {
    if (isLoading) {
        return (
            <Box>
                <Text color='yellow'>Scanning directories...</Text>
            </Box>
        )
    }

    const helpText = keymap
        .filter((s) => s.keyLabel !== '')
        .map((s) => `${s.keyLabel}: ${s.description}`)
        .join(' | ')

    return (
        <Box>
            <Text dimColor>{helpText}</Text>
        </Box>
    )
}
