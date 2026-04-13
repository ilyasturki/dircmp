import { Text } from 'ink'

import type { CellType, DiffCell as DiffCellData } from './diff-compute'

function colorFor(type: CellType): string | undefined {
    if (type === 'added' || type === 'removed' || type === 'changed')
        return 'yellow'
    return undefined
}

interface DiffCellProps {
    cell: DiffCellData
    inFocusedBlock: boolean
    isFocusedSide: boolean
    gutterWidth: number
    contentWidth: number
}

export function DiffCell({
    cell,
    inFocusedBlock,
    isFocusedSide,
    gutterWidth,
    contentWidth,
}: DiffCellProps) {
    const gutter =
        cell.lineNum !== null ?
            String(cell.lineNum).padStart(gutterWidth)
        :   ' '.repeat(gutterWidth)
    const isSelected = inFocusedBlock && isFocusedSide
    const bg = inFocusedBlock && !isFocusedSide ? 'blackBright' : undefined

    let body: React.ReactNode
    if (cell.segments) {
        const nodes: React.ReactNode[] = []
        let remaining = contentWidth
        let key = 0
        for (const seg of cell.segments) {
            if (remaining <= 0) break
            const text = seg.text.slice(0, remaining)
            remaining -= text.length
            if (seg.changed) {
                nodes.push(
                    <Text
                        key={key++}
                        color='red'
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
        body = nodes
    } else {
        body = cell.content.slice(0, contentWidth).padEnd(contentWidth)
    }

    return (
        <Text
            color={colorFor(cell.type)}
            backgroundColor={bg}
            inverse={isSelected}
        >
            <Text
                color={isFocusedSide ? 'cyan' : undefined}
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
