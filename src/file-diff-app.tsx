import path from 'node:path'
import { useApp, useStdout } from 'ink'
import { useCallback, useMemo, useReducer } from 'react'

import type { AppConfig } from '~/utils/config'
import type { Action, CompareEntry } from '~/utils/types'
import { AppShell } from '~/app-shell'
import { FileDiff } from '~/components/file-diff'
import { useTerminalDimensions } from '~/hooks'
import { defaultKeymap } from '~/keymap'
import { createInitialState, reducer } from '~/reducer'
import { loadKeybindings, resolveKeymap } from '~/utils/keybindings'

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

    const [state, rawDispatch] = useReducer(
        reducer,
        { config: initialConfig, ignoreEnabled: true },
        (init) => ({ ...createInitialState(init), view: 'fileDiff' as const }),
    )

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

    const entry: CompareEntry = {
        relativePath: path.basename(leftFile),
        name: path.basename(leftFile),
        isDirectory: false,
        status: 'modified',
        depth: 0,
        isExpanded: false,
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
        >
            <FileDiff
                entry={entry}
                leftDir=''
                rightDir=''
                leftFilePath={leftFile}
                rightFilePath={rightFile}
                dispatch={dispatch}
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
