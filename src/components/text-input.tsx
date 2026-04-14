import { Text, useInput } from 'ink'
import { useState } from 'react'

interface TextInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit?: (value: string) => void
    focus?: boolean
}

const inverse = (s: string) => `\x1b[7m${s}\x1b[27m`

export function TextInput({
    value: initialValue,
    onChange,
    onSubmit,
    focus = true,
}: TextInputProps) {
    const [state, setState] = useState(() => ({
        value: initialValue,
        cursor: initialValue.length,
    }))

    useInput(
        (input, key) => {
            if (
                key.upArrow
                || key.downArrow
                || key.tab
                || (key.ctrl && input === 'c')
            ) {
                return
            }

            if (key.return) {
                onSubmit?.(state.value)
                return
            }

            setState(({ value, cursor }) => {
                if (key.leftArrow) {
                    return { value, cursor: Math.max(0, cursor - 1) }
                }
                if (key.rightArrow) {
                    return { value, cursor: Math.min(value.length, cursor + 1) }
                }
                if (key.backspace) {
                    if (cursor === 0) return { value, cursor }
                    const next =
                        value.slice(0, cursor - 1) + value.slice(cursor)
                    onChange(next)
                    return { value: next, cursor: cursor - 1 }
                }
                if (key.delete) {
                    if (cursor === value.length) return { value, cursor }
                    const next =
                        value.slice(0, cursor) + value.slice(cursor + 1)
                    onChange(next)
                    return { value: next, cursor }
                }
                if (!input) return { value, cursor }
                const next =
                    value.slice(0, cursor) + input + value.slice(cursor)
                onChange(next)
                return { value: next, cursor: cursor + input.length }
            })
        },
        { isActive: focus },
    )

    const { value, cursor } = state
    let rendered: string
    if (focus) {
        if (value.length === 0) {
            rendered = inverse(' ')
        } else {
            let out = ''
            for (let i = 0; i < value.length; i++) {
                out += i === cursor ? inverse(value[i]!) : value[i]
            }
            if (cursor >= value.length) out += inverse(' ')
            rendered = out
        }
    } else {
        rendered = value
    }

    return <Text>{rendered}</Text>
}
