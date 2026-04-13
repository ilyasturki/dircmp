import { Box, Text } from 'ink'

import { TextInput } from './text-input'

interface InputFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    onSubmit: (value: string) => void
    editing?: boolean
    focus?: boolean
    highlighted?: boolean
    error?: string
    displayValue?: string
    hint?: string
    modified?: boolean
}

export function InputField({
    label,
    value,
    onChange,
    onSubmit,
    editing = true,
    focus = true,
    highlighted = true,
    error,
    displayValue,
    hint,
    modified = false,
}: InputFieldProps) {
    const marker = modified ? '*' : ' '
    if (!editing) {
        return (
            <Box flexDirection='column'>
                <Box justifyContent='space-between'>
                    <Text>
                        {marker}
                        <Text
                            bold={highlighted}
                            inverse={highlighted}
                        >
                            {' '}
                            {label}{' '}
                        </Text>
                    </Text>
                    <Text>{displayValue}</Text>
                </Box>
                {hint && <Text dimColor> {hint}</Text>}
            </Box>
        )
    }

    return (
        <Box flexDirection='column'>
            <Text wrap='wrap'>
                <Text bold>{label}: </Text>
                <TextInput
                    value={value}
                    onChange={onChange}
                    onSubmit={onSubmit}
                    focus={focus}
                />
            </Text>
            {error && <Text color='red'>{error}</Text>}
            {hint && !error && <Text dimColor> {hint}</Text>}
        </Box>
    )
}
