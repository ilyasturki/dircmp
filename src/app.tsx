import { Box, Text, useStdout } from 'ink'
import { useReducer } from 'react'

import type { AppConfig } from '~/utils/config'
import { DateLocaleProvider } from '~/context/date-locale'
import { DirectoryDiff } from '~/components/directory-diff'
import { PreferencesDialog } from '~/components/preferences-dialog'
import { StatusBar } from '~/components/status-bar'
import { useDirectoryScan, useKeymap, useTerminalDimensions } from '~/hooks'
import { keymap } from '~/keymap'
import { createInitialState, reducer } from '~/reducer'

interface AppProps {
    leftDir: string
    rightDir: string
    initialConfig: AppConfig
}

export function App({ leftDir, rightDir, initialConfig }: AppProps) {
    const [state, dispatch] = useReducer(
        reducer,
        initialConfig,
        createInitialState,
    )
    const { stdout } = useStdout()

    const { columns, rows } = useTerminalDimensions(stdout)
    const { refresh } = useDirectoryScan(leftDir, rightDir, dispatch)

    const effectiveLeftDir = state.swapped ? rightDir : leftDir
    const effectiveRightDir = state.swapped ? leftDir : rightDir

    useKeymap(
        state,
        effectiveLeftDir,
        effectiveRightDir,
        dispatch,
        !state.showPreferences,
        refresh,
    )

    if (columns < 40 || rows < 10) {
        return (
            <Box>
                <Text color='red'>
                    Terminal too small. Need at least 40x10.
                </Text>
            </Box>
        )
    }

    const isLoading = !state.leftScan || !state.rightScan

    if (state.error) {
        return (
            <Box>
                <Text color='red'>Error: {state.error}</Text>
            </Box>
        )
    }

    // Reserve rows: 1 for status bar, 3 for borders (top/bottom + status border)
    const contentHeight = Math.max(1, rows - 4)

    // Adjust scroll offset to keep cursor in view
    let { scrollOffset } = state
    if (state.cursorIndex < scrollOffset) {
        scrollOffset = state.cursorIndex
    } else if (state.cursorIndex >= scrollOffset + contentHeight) {
        scrollOffset = state.cursorIndex - contentHeight + 1
    }

    return (
        <Box
            flexDirection='column'
            height={rows}
        >
            {isLoading ?
                <Box
                    flexGrow={1}
                    justifyContent='center'
                    alignItems='center'
                >
                    <Text color='yellow'>Scanning directories...</Text>
                </Box>
            :   <DateLocaleProvider value={state.config.dateLocale}>
                    <DirectoryDiff
                        leftDir={effectiveLeftDir}
                        rightDir={effectiveRightDir}
                        entries={state.entries}
                        cursorIndex={state.cursorIndex}
                        focusedPanel={state.focusedPanel}
                        visibleHeight={contentHeight}
                        scrollOffset={scrollOffset}
                    />
                </DateLocaleProvider>
            }
            <StatusBar
                isLoading={isLoading}
                keymap={keymap}
                filterMode={state.filterMode}
            />
            {state.showPreferences && (
                <PreferencesDialog
                    config={state.config}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
        </Box>
    )
}
