import { Worker } from 'node:worker_threads'

import type { DiffRow } from './diff-compute'
import type { DiffRequest, DiffResponse } from './diff-worker'
import { computeDiffRows } from './diff-compute'

// index.tsx stamps the running bundle's own entry URL here. Spawning a worker
// that re-enters that gated entry is the only worker-bundling approach that
// survives `bun build --compile`, tsx/dev, and the node bundle alike. When it's
// absent — e.g. under `bun test`, where the entry isn't index.tsx — we have no
// worker to spawn and compute synchronously instead.
function entryUrl(): string | undefined {
    return (globalThis as { __DIRCMP_ENTRY_URL__?: string })
        .__DIRCMP_ENTRY_URL__
}

let worker: Worker | null = null
let workerUnavailable = false
let nextId = 1
const pending = new Map<
    number,
    { resolve: (rows: DiffRow[]) => void; req: DiffRequest }
>()

function syncFallback(req: DiffRequest): DiffRow[] {
    return computeDiffRows(
        req.leftContent,
        req.rightContent,
        req.leftName,
        req.rightName,
        req.context,
    )
}

function ensureWorker(): Worker | null {
    if (worker || workerUnavailable) return worker
    const url = entryUrl()
    if (!url) {
        workerUnavailable = true
        return null
    }
    try {
        const w = new Worker(new URL(url))
        w.on('message', (res: DiffResponse) => {
            const entry = pending.get(res.id)
            if (!entry) return
            pending.delete(res.id)
            entry.resolve('rows' in res ? res.rows : syncFallback(entry.req))
        })
        w.on('error', () => {
            // Worker crashed: finish anything in flight on the main thread and
            // stop using the worker for the rest of the session.
            workerUnavailable = true
            worker = null
            for (const [, entry] of pending)
                entry.resolve(syncFallback(entry.req))
            pending.clear()
        })
        // Don't let an idle worker keep the process alive after the TUI exits.
        w.unref()
        worker = w
    } catch {
        workerUnavailable = true
        worker = null
    }
    return worker
}

/**
 * Compute diff rows off the render thread when a worker is available, falling
 * back to a synchronous compute otherwise. Resolves with the same `DiffRow[]`
 * that `computeDiffRows` would return.
 */
export function computeDiffRowsAsync(
    leftContent: string,
    rightContent: string,
    leftName: string,
    rightName: string,
    context?: number,
): Promise<DiffRow[]> {
    const req: DiffRequest = {
        id: nextId++,
        leftContent,
        rightContent,
        leftName,
        rightName,
        context,
    }
    const w = ensureWorker()
    if (!w) return Promise.resolve(syncFallback(req))
    return new Promise<DiffRow[]>((resolve) => {
        pending.set(req.id, { resolve, req })
        w.postMessage(req)
    })
}
