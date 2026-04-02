import { Box, Text, useApp, useStdout } from 'ink'
import { useCallback, useReducer } from 'react'

import type { AppConfig } from '~/utils/config'
import type { Action } from '~/utils/types'
import { ConfirmDeleteDialog } from '~/components/confirm-delete-dialog'
import { ContextMenu } from '~/components/context-menu'
import { DirectoryDiff } from '~/components/directory-diff'
import { IgnoreDialog } from '~/components/ignore-dialog'
import { PreferencesDialog } from '~/components/preferences-dialog'
import { StatusBar } from '~/components/status-bar'
import { DateLocaleProvider } from '~/context/date-locale'
import { executeAction } from '~/execute-action'
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
    const { refresh } = useDirectoryScan(
        leftDir,
        rightDir,
        dispatch,
        state.ignoreEnabled,
    )

    const effectiveLeftDir = state.swapped ? rightDir : leftDir
    const effectiveRightDir = state.swapped ? leftDir : rightDir

    // Reserve rows: 2 for status bar, 3 for borders (top/bottom + status border)
    const contentHeight = Math.max(1, rows - 5)

    const { exit } = useApp()

    useKeymap(
        state,
        effectiveLeftDir,
        effectiveRightDir,
        dispatch,
        !state.showPreferences
            && !state.showDeleteConfirm
            && !state.showContextMenu
            && !state.showIgnoreDialog,
        refresh,
        contentHeight,
    )

    const onExecuteAction = useCallback(
        (action: Action) => {
            executeAction(
                action,
                state,
                effectiveLeftDir,
                effectiveRightDir,
                dispatch,
                exit,
                refresh,
            )
        },
        [state, effectiveLeftDir, effectiveRightDir, dispatch, exit, refresh],
    )

    const isLoading = !state.leftScan || !state.rightScan

    if (state.error) {
        return (
            <Box>
                <Text color='red'>Error: {state.error}</Text>
            </Box>
        )
    }

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
                ignoreEnabled={state.ignoreEnabled}
                focusedEntry={state.entries[state.cursorIndex]}
                leftDir={effectiveLeftDir}
                rightDir={effectiveRightDir}
                leftScan={state.leftScan}
                rightScan={state.rightScan}
            />
            {state.showPreferences && (
                <PreferencesDialog
                    config={state.config}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.showDeleteConfirm && state.entries[state.cursorIndex] && (
                <ConfirmDeleteDialog
                    entry={state.entries[state.cursorIndex]!}
                    side={state.focusedPanel}
                    leftDir={effectiveLeftDir}
                    rightDir={effectiveRightDir}
                    dispatch={dispatch}
                    refresh={refresh}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.showIgnoreDialog && (
                <IgnoreDialog
                    globalPatterns={state.globalIgnorePatterns}
                    pairPatterns={state.pairIgnorePatterns}
                    leftDir={leftDir}
                    rightDir={rightDir}
                    dispatch={dispatch}
                    refresh={refresh}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.showContextMenu && state.entries[state.cursorIndex] && (
                <ContextMenu
                    entry={state.entries[state.cursorIndex]!}
                    side={state.focusedPanel}
                    dispatch={dispatch}
                    onExecuteAction={onExecuteAction}
                    columns={columns}
                    rows={rows}
                />
            )}
        </Box>
    )
}
