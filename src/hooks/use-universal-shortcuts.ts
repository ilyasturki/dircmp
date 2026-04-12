import type { Dispatch } from 'react'
import { useInput } from 'ink'

import type { Shortcut } from '~/keymap'
import type { Action, ViewType } from '~/utils/types'

export function useUniversalShortcuts(
    keymap: Shortcut[],
    dispatch: Dispatch<Action>,
    isActive: boolean,
    viewMode?: ViewType,
): void {
    useInput(
        (input, key) => {
            for (const shortcut of keymap) {
                if (shortcut.mode !== 'universal' && shortcut.mode !== viewMode)
                    continue
                if (!shortcut.match(input, key)) continue
                if (shortcut.effect.type === 'dispatch') {
                    dispatch(shortcut.effect.action)
                }
                return
            }
        },
        { isActive },
    )
}
