import type { TextProps } from 'ink'
import type { ReactNode } from 'react'
import { Text } from 'ink'
import { memo } from 'react'

import type { CellType, DiffCell as DiffCellData } from './diff-compute'
import { theme } from '~/utils/theme'

const CR_GLYPH = '\u240D'

function colorFor(type: CellType): TextProps['color'] {
    if (type === 'added') return theme.diffAddedLine
    if (type === 'removed' || type === 'changed') return theme.diffRemovedLine
    return undefined
}

// Renders text that may contain \r by splitting on \r and substituting each
// with a dim-grey ␍ glyph. Raw \r would otherwise reach the terminal and
// drag the cursor back to column 0, smearing highlights across the line.
function renderWithCrGlyph(
    text: string,
    nextKey: () => number,
    baseProps: TextProps,
): ReactNode[] {
    if (!text.includes('\r')) {
        return [
            <Text
                key={nextKey()}
                {...baseProps}
            >
                {text}
            </Text>,
        ]
    }
    const out: ReactNode[] = []
    let i = 0
    while (i < text.length) {
        const next = text.indexOf('\r', i)
        if (next === -1) {
            out.push(
                <Text
                    key={nextKey()}
                    {...baseProps}
                >
                    {text.slice(i)}
                </Text>,
            )
            break
        }
        if (next > i) {
            out.push(
                <Text
                    key={nextKey()}
                    {...baseProps}
                >
                    {text.slice(i, next)}
                </Text>,
            )
        }
        out.push(
            <Text
                key={nextKey()}
                color={theme.dimText}
                dimColor
            >
                {CR_GLYPH}
            </Text>,
        )
        i = next + 1
    }
    return out
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

export const DiffCell = memo(function DiffCell({
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
        const nextKey = () => key++
        for (const seg of cell.segments) {
            if (remaining <= 0) break
            const text = seg.text.slice(0, remaining)
            remaining -= text.length
            const props: TextProps =
                seg.changed ?
                    { color: theme.diffChangedSegment, bold: true }
                :   { backgroundColor: bg, inverse: isSelected }
            nodes.push(...renderWithCrGlyph(text, nextKey, props))
        }
        if (remaining > 0) {
            nodes.push(
                <Text
                    key={nextKey()}
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
                    key={nextKey()}
                    color={theme.dimText}
                    dimColor
                >
                    {'\u203A'}
                </Text>,
            )
        }
        body = nodes
    } else if (truncated) {
        let key = 0
        const nextKey = () => key++
        body = (
            <>
                {renderWithCrGlyph(
                    cell.content.slice(0, bodyWidth).padEnd(bodyWidth),
                    nextKey,
                    { backgroundColor: bg, inverse: isSelected },
                )}
                <Text
                    color={theme.dimText}
                    dimColor
                >
                    {'\u203A'}
                </Text>
            </>
        )
    } else {
        const text = cell.content.slice(0, contentWidth).padEnd(contentWidth)
        if (text.includes('\r')) {
            let key = 0
            const nextKey = () => key++
            body = renderWithCrGlyph(text, nextKey, {})
        } else {
            body = text
        }
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
})
