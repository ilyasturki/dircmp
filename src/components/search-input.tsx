import type { Dispatch } from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import type { Action } from '~/utils/types'
import { TextInput } from './text-input'

interface SearchInputProps {
    initialQuery: string
    matchCount: number
    dispatch: Dispatch<Action>
}

export function SearchInput({
    initialQuery,
    matchCount,
    dispatch,
}: SearchInputProps) {
    const [inputValue, setInputValue] = useState(initialQuery)

    useInput((_input, key) => {
        if (key.escape) {
            dispatch({ type: 'CANCEL_SEARCH' })
        }
    })

    function handleChange(value: string) {
        setInputValue(value)
        dispatch({ type: 'SET_SEARCH_QUERY', query: value })
    }

    function handleSubmit() {
        dispatch({ type: 'CLOSE_SEARCH' })
    }

    return (
        <Box justifyContent='space-between'>
            <Text wrap='wrap'>
                <Text color='cyan'>/</Text>
                <TextInput
                    value={inputValue}
                    onChange={handleChange}
                    onSubmit={handleSubmit}
                    focus={true}
                />
            </Text>
            <Text dimColor>
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </Text>
        </Box>
    )
}
