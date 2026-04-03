import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

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
}: InputFieldProps) {
    if (!editing) {
        return (
            <Box flexDirection='column'>
                <Text>
                    <Text
                        bold={highlighted}
                        inverse={highlighted}
                    >
                        {' '}
                        {label}{' '}
                    </Text>
                    <Text> {displayValue}</Text>
                </Text>
                {hint && <Text dimColor>  {hint}</Text>}
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
            {hint && !error && <Text dimColor>  {hint}</Text>}
        </Box>
    )
}
