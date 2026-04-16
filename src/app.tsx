import { spawnSync } from 'node:child_process'
import { Box, Text, useApp, useStdout } from 'ink'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import type { CliIgnoreOptions } from '~/cli/types'
import type { AppConfig } from '~/utils/config'
import type { Action, ScanResult } from '~/utils/types'
import { AppShell } from '~/app-shell'
import { ContextMenu } from '~/components/context-menu'
import { ConfirmDeleteDialog } from '~/components/dialogs/confirm-delete-dialog'
import { FilterDialog } from '~/components/dialogs/filter-dialog'
import { IgnoreDialog } from '~/components/dialogs/ignore-dialog'
import { QuickIgnoreDialog } from '~/components/dialogs/quick-ignore-dialog'
import { SortDialog } from '~/components/dialogs/sort-dialog'
import { FileDiff } from '~/components/file-diff'
import { DirectoryDiff } from '~/components/panels/directory-diff'
import { StatusBar } from '~/components/status-bar'
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
import { theme } from '~/utils/theme'
import { initTrashSession } from '~/utils/trash'

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
    changelog: string
    followSymlinks?: boolean
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
    changelog,
    followSymlinks = false,
}: AppProps) {
    const [state, dispatch] = useReducer(
        reducer,
        { config: initialConfig, ignoreEnabled: !ignoreOptions?.noIgnore },
        createInitialState,
    )
    useEffect(() => {
        initTrashSession()
    }, [])
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
        state.config.compareContents,
        followSymlinks,
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
            process.stdout.write('\x1b[?1049l\x1b[?25h')
            const result = spawnSync(command, args, { stdio: 'inherit' })
            process.stdout.write('\x1b[?1049h\x1b[?25l')
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
        state.view === 'directoryDiff'
            && state.dialog === null
            && !state.searchInputActive,
        refresh,
        contentHeight,
        handleShellOut,
        showToast,
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
                showToast,
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
            showToast,
        ],
    )

    const isLoading = !state.leftScan || !state.rightScan

    // Adjust scroll offset to keep cursor in view. Clamp against entries length
    // so it stays valid after entries shrink (collapse, re-scan, filter).
    let scrollOffset = state.scrollOffset
    const maxScrollOffset = Math.max(0, state.entries.length - contentHeight)
    scrollOffset = Math.max(0, Math.min(scrollOffset, maxScrollOffset))
    if (state.cursorIndex < scrollOffset) {
        scrollOffset = state.cursorIndex
    } else if (state.cursorIndex >= scrollOffset + contentHeight) {
        scrollOffset = state.cursorIndex - contentHeight + 1
    }

    // Persist the adjusted offset so subsequent cursor moves inside the viewport
    // don't recompute from a stale baseline (e.g., after jump-to-bottom).
    useEffect(() => {
        if (scrollOffset !== state.scrollOffset) {
            dispatch({ type: 'SET_SCROLL_OFFSET', offset: scrollOffset })
        }
    }, [scrollOffset, state.scrollOffset])

    if (state.error) {
        return (
            <Box>
                <Text color={theme.errorText}>Error: {state.error}</Text>
            </Box>
        )
    }

    return (
        <AppShell
            state={state}
            dispatch={dispatch}
            keymap={keymap}
            columns={columns}
            rows={rows}
            changelog={changelog}
            onExit={exit}
            onExecuteAction={onExecuteAction}
        >
            {isLoading ?
                <Box
                    flexGrow={1}
                    justifyContent='center'
                    alignItems='center'
                >
                    <Text color={theme.loading}>Scanning directories...</Text>
                </Box>
            :   <DirectoryDiff
                    leftDir={effectiveLeftDir}
                    rightDir={effectiveRightDir}
                    leftLabel={effectiveLeftLabel}
                    rightLabel={effectiveRightLabel}
                    entries={state.entries}
                    cursorIndex={state.cursorIndex}
                    focusedPanel={state.focusedPanel}
                    dialogOpen={
                        state.view !== 'directoryDiff'
                        || state.dialog !== null
                        || state.searchInputActive
                    }
                    visibleHeight={contentHeight}
                    scrollOffset={scrollOffset}
                    searchQuery={state.searchQuery}
                    pendingPairMark={state.pendingPairMark}
                />
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
                compareContents={state.config.compareContents}
                searchInputActive={state.searchInputActive}
                searchQuery={state.searchQuery}
                columns={columns}
                entryCount={state.entries.length}
                dispatch={dispatch}
                pendingPairMark={state.pendingPairMark}
                sortMode={state.sortMode}
                sortDirection={state.sortDirection}
            />
            {state.view === 'fileDiff'
                && state.fileDiffEntryIndex !== null
                && state.entries[state.fileDiffEntryIndex] && (
                    <FileDiff
                        entry={state.entries[state.fileDiffEntryIndex]!}
                        leftDir={effectiveLeftDir}
                        rightDir={effectiveRightDir}
                        dispatch={dispatch}
                        onToast={showToast}
                        columns={columns}
                        rows={rows}
                        keymap={keymap}
                        dialogOpen={state.dialog !== null}
                        showHints={state.config.showHints}
                        focusedSide={state.focusedPanel}
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
            {state.dialog === 'sortMenu' && (
                <SortDialog
                    currentMode={state.sortMode}
                    currentDirection={state.sortDirection}
                    config={state.config}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.dialog === 'filterMenu' && (
                <FilterDialog
                    currentMode={state.filterMode}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
        </AppShell>
    )
}
