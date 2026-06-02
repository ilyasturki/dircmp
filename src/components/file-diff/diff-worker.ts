import { parentPort } from 'node:worker_threads'

import type { DiffRow } from './diff-compute'
import { computeDiffRows } from './diff-compute'

export interface DiffRequest {
    id: number
    leftContent: string
    rightContent: string
    leftName: string
    rightName: string
    context: number | undefined
}

export type DiffResponse =
    | { id: number; rows: DiffRow[] }
    | { id: number; error: string }

// Runs on the worker thread (index.tsx calls this when !isMainThread). The Myers
// line-diff is the one CPU-heavy step in the diff view; doing it here keeps the
// render thread free so input never stalls while a large diff computes.
//
// The handler is attached synchronously during module evaluation — not behind an
// async import — so a request posted immediately after the worker spawns is never
// dropped (some runtimes don't queue pre-listener messages).
export function runDiffWorker(): void {
    const port = parentPort
    if (!port) return
    port.on('message', (req: DiffRequest) => {
        try {
            const rows = computeDiffRows(
                req.leftContent,
                req.rightContent,
                req.leftName,
                req.rightName,
                req.context,
            )
            port.postMessage({ id: req.id, rows } satisfies DiffResponse)
        } catch (e) {
            port.postMessage({
                id: req.id,
                error: e instanceof Error ? e.message : 'diff failed',
            } satisfies DiffResponse)
        }
    })
}
