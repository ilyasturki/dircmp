import { spawnSync } from 'node:child_process'
import { Box, Text, useApp, useStdout } from 'ink'
import { terminal } from 'os-theme'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import type { CliIgnoreOptions } from '~/cli/types'
import type { AppConfig } from '~/utils/config'
import type { Action, ScanResult } from '~/utils/types'
import { ConfirmDeleteDialog } from '~/components/confirm-delete-dialog'
import { ContextMenu } from '~/components/context-menu'
import { DiffView } from '~/components/diff-view'
import { DirectoryDiff } from '~/components/directory-diff'
import { HelpDialog } from '~/components/help-dialog'
import { IgnoreDialog } from '~/components/ignore-dialog'
import { KeybindingsDialog } from '~/components/keybindings-dialog'
import { PreferencesDialog } from '~/components/preferences-dialog'
import { QuickIgnoreDialog } from '~/components/quick-ignore-dialog'
import { StatusBar } from '~/components/status-bar'
import { DateLocaleProvider } from '~/context/date-locale'
import { TerminalThemeProvider } from '~/context/terminal-theme'
import { executeAction } from '~/execute-action'
import {
    useDirectoryScan,
    useKeymap,
    useTerminalDimensions,
    useToast,
} from '~/hooks'
import { defaultKeymap } from '~/keymap'
import { createInitialState, reducer } from '~/reducer'
import { loadKeybindings, resolveKeymap } from '~/utils/keybindings'

interface AppProps {
    leftDir: string
    rightDir: string
    leftLabel?: string
    rightLabel?: string
    leftRemote?: string
    rightRemote?: string
    leftPreScan?: ScanResult
    rightPreScan?: ScanResult
    initialConfig: AppConfig
    ignoreOptions?: CliIgnoreOptions
    terminalTheme: 'dark' | 'light'
}

export function App({
    leftDir,
    rightDir,
    leftLabel,
    rightLabel,
    leftRemote,
    rightRemote,
    leftPreScan,
    rightPreScan,
    initialConfig,
    ignoreOptions,
    terminalTheme,
}: AppProps) {
    const [theme, setTheme] = useState(terminalTheme)

    useEffect(() => {
        terminal.on('change', setTheme)
        return () => {
            terminal.off('change', setTheme)
        }
    }, [])

    const [state, dispatch] = useReducer(
        reducer,
        { config: initialConfig, ignoreEnabled: !ignoreOptions?.noIgnore },
        createInitialState,
    )
    const { stdout } = useStdout()

    const { columns, rows } = useTerminalDimensions(stdout)
    const { toastMessage, showToast } = useToast()
    const { refresh } = useDirectoryScan(
        leftDir,
        rightDir,
        dispatch,
        state.ignoreEnabled,
        showToast,
        ignoreOptions?.extraIgnorePatterns,
        leftRemote,
        rightRemote,
        leftPreScan,
        rightPreScan,
    )

    const effectiveLeftDir = state.swapped ? rightDir : leftDir
    const effectiveRightDir = state.swapped ? leftDir : rightDir
    const effectiveLeftLabel = state.swapped ? rightLabel : leftLabel
    const effectiveRightLabel = state.swapped ? leftLabel : rightLabel

    // Reserve rows: status bar (2 with hints, 1 without) + 3 for borders
    const contentHeight = Math.max(1, rows - (state.config.showHints ? 5 : 4))

    const { exit } = useApp()

    const keymap = useMemo(() => {
        const overrides = loadKeybindings()
        return resolveKeymap(defaultKeymap, overrides)
    }, [state.keybindingVersion])

    const handleShellOut = useCallback(
        (command: string, args: string[]) => {
            process.stdout.write('\x1b[?1049l')
            const result = spawnSync(command, args, { stdio: 'inherit' })
            process.stdout.write('\x1b[?1049h')
            dispatch({ type: 'REDRAW' })
            if (result.error) {
                showToast(`Failed to run: ${command} (${result.error.message})`)
            }
        },
        [dispatch, showToast],
    )

    useKeymap(
        state,
        keymap,
        effectiveLeftDir,
        effectiveRightDir,
        dispatch,
        state.dialog === null && !state.searchInputActive,
        refresh,
        contentHeight,
        handleShellOut,
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
                handleShellOut,
            )
        },
        [
            state,
            effectiveLeftDir,
            effectiveRightDir,
            dispatch,
            exit,
            refresh,
            handleShellOut,
        ],
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
            :   <TerminalThemeProvider value={theme}>
                    <DateLocaleProvider value={state.config.dateLocale}>
                        <DirectoryDiff
                            leftDir={effectiveLeftDir}
                            rightDir={effectiveRightDir}
                            leftLabel={effectiveLeftLabel}
                            rightLabel={effectiveRightLabel}
                            entries={state.entries}
                            cursorIndex={state.cursorIndex}
                            focusedPanel={state.focusedPanel}
                            dialogOpen={
                                state.dialog !== null || state.searchInputActive
                            }
                            visibleHeight={contentHeight}
                            scrollOffset={scrollOffset}
                            searchQuery={state.searchQuery}
                        />
                    </DateLocaleProvider>
                </TerminalThemeProvider>
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
                toastMessage={toastMessage}
                showHints={state.config.showHints}
                compareDates={state.config.compareDates}
                searchInputActive={state.searchInputActive}
                searchQuery={state.searchQuery}
                columns={columns}
                entryCount={state.entries.length}
                dispatch={dispatch}
            />
            {state.dialog === 'preferences' && (
                <PreferencesDialog
                    config={state.config}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.dialog === 'deleteConfirm'
                && state.entries[state.cursorIndex] && (
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
            {state.dialog === 'ignoreDialog' && (
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
            {state.dialog === 'quickIgnore'
                && state.entries[state.cursorIndex] && (
                    <QuickIgnoreDialog
                        entry={state.entries[state.cursorIndex]!}
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
            {state.dialog === 'contextMenu'
                && state.entries[state.cursorIndex] && (
                    <ContextMenu
                        entry={state.entries[state.cursorIndex]!}
                        side={state.focusedPanel}
                        dispatch={dispatch}
                        onExecuteAction={onExecuteAction}
                        columns={columns}
                        rows={rows}
                    />
                )}
            {state.dialog === 'help' && (
                <HelpDialog
                    keymap={keymap}
                    dispatch={dispatch}
                    onExecuteAction={onExecuteAction}
                    onExit={exit}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.dialog === 'keybindingsEditor' && (
                <KeybindingsDialog
                    defaults={defaultKeymap}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.dialog === 'diffView'
                && state.diffViewEntryIndex !== null
                && state.entries[state.diffViewEntryIndex] && (
                    <DiffView
                        entry={state.entries[state.diffViewEntryIndex]!}
                        leftDir={effectiveLeftDir}
                        rightDir={effectiveRightDir}
                        dispatch={dispatch}
                        columns={columns}
                        rows={rows}
                    />
                )}
        </Box>
    )
}
