import { Text } from 'ink'

interface KeyboardHint {
    key: string
    label: string
}

interface KeyboardHintsProps {
    items: KeyboardHint[]
}

export function KeyboardHints({ items }: KeyboardHintsProps) {
    const text = items.map((i) => `${i.key}: ${i.label}`).join(' | ')
    return <Text dimColor>{text}</Text>
}
