import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

interface InputFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    onSubmit: (value: string) => void
    editing?: boolean
    focus?: boolean
    error?: string
    displayValue?: string
}

export function InputField({
    label,
    value,
    onChange,
    onSubmit,
    editing = true,
    focus = true,
    error,
    displayValue,
}: InputFieldProps) {
    if (!editing) {
        return (
            <Box flexDirection='column'>
                <Text>
                    <Text
                        bold
                        inverse
                    >
                        {' '}
                        {label}{' '}
                    </Text>
                    <Text> {displayValue}</Text>
                </Text>
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
        </Box>
    )
}
