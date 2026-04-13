import path from 'node:path'
import { useApp, useStdout } from 'ink'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import type { AppConfig } from '~/utils/config'
import type { Action, CompareEntry } from '~/utils/types'
import { AppShell } from '~/app-shell'
import { FileDiff } from '~/components/file-diff'
import { executeAction } from '~/execute-action'
import { useTerminalDimensions, useToast } from '~/hooks'
import { defaultKeymap } from '~/keymap'
import { createInitialState, reducer } from '~/reducer'
import { loadKeybindings, resolveKeymap } from '~/utils/keybindings'
import { initTrashSession } from '~/utils/trash'

interface FileDiffAppProps {
    leftFile: string
    rightFile: string
    initialConfig: AppConfig
    changelog: string
}

export function FileDiffApp({
    leftFile,
    rightFile,
    initialConfig,
    changelog,
}: FileDiffAppProps) {
    const { exit } = useApp()
    const { stdout } = useStdout()
    const { columns, rows } = useTerminalDimensions(stdout)
    const { showToast } = useToast()

    useEffect(() => {
        initTrashSession()
    }, [])

    const [state, rawDispatch] = useReducer(
        reducer,
        { config: initialConfig, ignoreEnabled: true },
        (init) => ({ ...createInitialState(init), view: 'fileDiff' as const }),
    )

    const [refreshCounter, setRefreshCounter] = useState(0)
    const refresh = useCallback(() => {
        setRefreshCounter((c) => c + 1)
    }, [])

    const keymap = useMemo(() => {
        const overrides = loadKeybindings()
        return resolveKeymap(defaultKeymap, overrides)
    }, [state.keybindingVersion])

    const dispatch = useCallback(
        (action: Action) => {
            if (action.type === 'HIDE_FILE_DIFF') {
                exit()
                return
            }
            rawDispatch(action)
        },
        [exit],
    )

    const onExecuteAction = useCallback(
        (action: Action) => {
            executeAction(
                action,
                state,
                leftFile,
                rightFile,
                dispatch,
                exit,
                refresh,
                undefined,
                showToast,
            )
        },
        [state, leftFile, rightFile, dispatch, exit, refresh, showToast],
    )

    const entry: CompareEntry = useMemo(
        () => ({
            relativePath: path.basename(leftFile),
            name: path.basename(leftFile),
            isDirectory: false,
            status: 'modified',
            depth: 0,
            isExpanded: false,
        }),
        [leftFile, refreshCounter],
    )

    return (
        <AppShell
            state={state}
            dispatch={dispatch}
            keymap={keymap}
            columns={columns}
            rows={rows}
            changelog={changelog}
            onExit={exit}
        >
            <FileDiff
                entry={entry}
                leftDir=''
                rightDir=''
                leftFilePath={leftFile}
                rightFilePath={rightFile}
                dispatch={dispatch}
                onExecuteAction={onExecuteAction}
                columns={columns}
                rows={rows}
                keymap={keymap}
                dialogOpen={state.dialog !== null}
                showHints={state.config.showHints}
                focusedSide={state.focusedPanel}
            />
        </AppShell>
    )
}
