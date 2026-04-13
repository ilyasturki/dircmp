import type { UndoEntry } from '~/utils/types'

export const UNDO_STACK_LIMIT = 50

export function pushUndo(
    stack: UndoEntry[],
    entry: UndoEntry,
    limit: number = UNDO_STACK_LIMIT,
): UndoEntry[] {
    const next = [...stack, entry]
    if (next.length > limit) next.splice(0, next.length - limit)
    return next
}
