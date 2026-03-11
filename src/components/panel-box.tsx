import { Box, Text, useStdout } from 'ink'
import type { ReactNode } from 'react'

interface PanelBoxProps {
    title: string
    borderColor: string
    children: ReactNode
}

export function PanelBox({ title, borderColor, children }: PanelBoxProps) {
    const { stdout } = useStdout()
    const panelWidth = Math.floor((stdout?.columns ?? 80) / 2)

    // Build top border: ┏ title ━━━┓
    // Account for ┏ + space before title + space after title + ┓ = 4 chars
    const maxTitleLen = panelWidth - 4
    const displayTitle =
        title.length > maxTitleLen
            ? title.slice(0, maxTitleLen - 1) + '…'
            : title
    const fillLen = panelWidth - 3 - displayTitle.length // ┏ + title + fill + ┓
    const topBorder = `┏ ${displayTitle} ${'━'.repeat(Math.max(0, fillLen - 1))}┓`

    return (
        <Box flexDirection="column" width="50%">
            <Text color={borderColor}>{topBorder}</Text>
            <Box
                borderStyle="bold"
                borderTop={false}
                borderColor={borderColor}
                flexDirection="column"
                flexGrow={1}
            >
                {children}
            </Box>
        </Box>
    )
}
