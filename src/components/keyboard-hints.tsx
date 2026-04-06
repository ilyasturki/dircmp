import { Text } from 'ink'

interface KeyboardHint {
    key: string
    label: string
}

interface KeyboardHintsProps {
    items: KeyboardHint[]
    columns: number
}

export function KeyboardHints({ items, columns }: KeyboardHintsProps) {
    const separator = ' | '
    const parts: string[] = []
    let length = 0

    for (const item of items) {
        const part = `${item.key}: ${item.label}`
        const added = length === 0 ? part.length : separator.length + part.length
        if (length + added > columns) break
        parts.push(part)
        length += added
    }

    return <Text dimColor>{parts.join(separator)}</Text>
}
