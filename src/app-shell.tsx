import type { Dispatch, ReactNode } from 'react'
import { Box, Text } from 'ink'

import type { Shortcut } from '~/keymap'
import type { Action, AppState } from '~/utils/types'
import { HelpDialog } from '~/components/dialogs/help-dialog'
import { KeybindingsDialog } from '~/components/dialogs/keybindings-dialog'
import { PreferencesDialog } from '~/components/dialogs/preferences-dialog'
import { ReleaseNotesDialog } from '~/components/dialogs/release-notes-dialog'
import { DateLocaleProvider } from '~/context/date-locale'
import { NerdFontProvider } from '~/context/nerd-font'
import { defaultKeymap } from '~/keymap'

interface AppShellProps {
    state: AppState
    dispatch: Dispatch<Action>
    keymap: Shortcut[]
    columns: number
    rows: number
    changelog: string
    onExit: () => void
    onExecuteAction?: (action: Action) => void
    children: ReactNode
}

export function AppShell({
    state,
    dispatch,
    keymap,
    columns,
    rows,
    changelog,
    onExit,
    onExecuteAction,
    children,
}: AppShellProps) {
    return (
        <Box
            flexDirection='column'
            height={rows}
        >
            <DateLocaleProvider value={state.config.dateLocale}>
                <NerdFontProvider value={state.config.nerdFont}>
                    {children}
                </NerdFontProvider>
            </DateLocaleProvider>
            {state.dialog === 'preferences' && (
                <PreferencesDialog
                    config={state.config}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
            {state.dialog === 'help' && (
                <HelpDialog
                    keymap={keymap}
                    dispatch={dispatch}
                    onExecuteAction={onExecuteAction ?? dispatch}
                    onExit={onExit}
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
            {state.dialog === 'releaseNotes' && (
                <ReleaseNotesDialog
                    changelog={changelog}
                    dispatch={dispatch}
                    columns={columns}
                    rows={rows}
                />
            )}
            {/*
                Why: after shelling out to $EDITOR/diff tool we exit and re-enter
                the alt screen, which leaves Ink's last-output cache matching the
                (now blank) terminal — the next render would be a no-op and the
                UI looks frozen until the user presses a key. REDRAW increments
                redrawNonce, and emitting a variable number of zero-width spaces
                here guarantees Ink's computed output string changes and the
                full frame is rewritten.
            */}
            <Text>{'\u200B'.repeat(state.redrawNonce & 1)}</Text>
        </Box>
    )
}
