import type { TextProps } from 'ink'
import type { ReactNode } from 'react'
import { Box, Text, useStdout } from 'ink'

import type { PanelSide } from '~/utils/types'

interface PanelBoxProps {
    title: string
    borderColor: TextProps['color']
    side: PanelSide
    children: ReactNode
}

export function PanelBox({
    title,
    borderColor,
    side,
    children,
}: PanelBoxProps) {
    const { stdout } = useStdout()
    const columns = stdout?.columns ?? 80
    // Yoga gives the first (left) child Math.ceil and the second (right) Math.floor
    const panelWidth =
        side === 'left' ? Math.ceil(columns / 2) : Math.floor(columns / 2)

    const topBorder = buildTopBorder(title, panelWidth)

    return (
        <Box
            flexDirection='column'
            width={panelWidth}
        >
            <Text color={borderColor}>{topBorder}</Text>
            <Box
                borderStyle='bold'
                borderTop={false}
                borderColor={borderColor}
                flexDirection='column'
                flexGrow={1}
            >
                {children}
            </Box>
        </Box>
    )
}

function buildTopBorder(title: string, width: number): string {
    const maxTitleLen = width - 4
    const displayTitle =
        title.length > maxTitleLen ?
            title.slice(0, Math.max(0, maxTitleLen - 1)) + '…'
        :   title
    const fillLen = width - 3 - displayTitle.length
    return `┏ ${displayTitle} ${'━'.repeat(Math.max(0, fillLen - 1))}┓`
}
