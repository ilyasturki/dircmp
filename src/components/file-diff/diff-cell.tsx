import type { TextProps } from 'ink'
import { Text } from 'ink'

import type { CellType, DiffCell as DiffCellData } from './diff-compute'
import { theme } from '~/utils/theme'

function colorFor(type: CellType): TextProps['color'] {
    if (type === 'added') return theme.diffAddedLine
    if (type === 'removed' || type === 'changed') return theme.diffRemovedLine
    return undefined
}

interface DiffCellProps {
    cell: DiffCellData
    inFocusedBlock: boolean
    isFocusedSide: boolean
    gutterWidth: number
    contentWidth: number
    showTruncationIndicator?: boolean
    gutterOverride?: string
}

export function DiffCell({
    cell,
    inFocusedBlock,
    isFocusedSide,
    gutterWidth,
    contentWidth,
    showTruncationIndicator = true,
    gutterOverride,
}: DiffCellProps) {
    const gutter =
        gutterOverride
        ?? (cell.lineNum !== null ?
            String(cell.lineNum).padStart(gutterWidth)
        :   ' '.repeat(gutterWidth))
    const isSelected = inFocusedBlock && isFocusedSide
    const bg =
        inFocusedBlock && !isFocusedSide ? theme.dimSelectedBg : undefined

    const truncated =
        showTruncationIndicator && cell.content.length > contentWidth
    const bodyWidth = truncated ? Math.max(0, contentWidth - 1) : contentWidth

    let body: React.ReactNode
    if (cell.segments) {
        const nodes: React.ReactNode[] = []
        let remaining = bodyWidth
        let key = 0
        for (const seg of cell.segments) {
            if (remaining <= 0) break
            const text = seg.text.slice(0, remaining)
            remaining -= text.length
            if (seg.changed) {
                nodes.push(
                    <Text
                        key={key++}
                        color={theme.diffChangedSegment}
                        bold
                    >
                        {text}
                    </Text>,
                )
            } else {
                nodes.push(
                    <Text
                        key={key++}
                        backgroundColor={bg}
                        inverse={isSelected}
                    >
                        {text}
                    </Text>,
                )
            }
        }
        if (remaining > 0) {
            nodes.push(
                <Text
                    key={key++}
                    backgroundColor={bg}
                    inverse={isSelected}
                >
                    {' '.repeat(remaining)}
                </Text>,
            )
        }
        if (truncated) {
            nodes.push(
                <Text
                    key={key++}
                    color={theme.dimText}
                    dimColor
                >
                    {'\u203A'}
                </Text>,
            )
        }
        body = nodes
    } else if (truncated) {
        body = (
            <>
                <Text
                    backgroundColor={bg}
                    inverse={isSelected}
                >
                    {cell.content.slice(0, bodyWidth).padEnd(bodyWidth)}
                </Text>
                <Text
                    color={theme.dimText}
                    dimColor
                >
                    {'\u203A'}
                </Text>
            </>
        )
    } else {
        body = cell.content.slice(0, contentWidth).padEnd(contentWidth)
    }

    // Blank cells have no fg color — without one, `inverse` flips the terminal
    // default (black on light themes) into the background, producing black bars.
    const outerColor =
        colorFor(cell.type)
        ?? (cell.type === 'blank' ? theme.errorText : undefined)

    return (
        <Text
            color={outerColor}
            backgroundColor={bg}
            inverse={isSelected}
        >
            <Text
                color={isFocusedSide ? theme.diffGutterFocused : undefined}
                dimColor={!isFocusedSide}
                backgroundColor={bg}
                inverse={isSelected}
            >
                {gutter}
                {'\u2502'}
            </Text>{' '}
            {body}
        </Text>
    )
}
