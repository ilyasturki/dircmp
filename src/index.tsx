import { isMainThread } from 'node:worker_threads'

import { runDiffWorker } from '~/components/file-diff/diff-worker'

// Expose this bundle's own entry URL so the diff client can spawn a worker that
// re-enters this same (gated) entry — the only worker approach that survives
// `bun build --compile`, tsx/dev, and the node bundle alike. Stamped before the
// gate so both threads see it.

;(globalThis as { __DIRCMP_ENTRY_URL__?: string }).__DIRCMP_ENTRY_URL__ =
    import.meta.url

if (isMainThread) {
    // Main thread: run the CLI / TUI. Loaded dynamically so the worker thread
    // never pulls in meow/ink/react — only diff-compute.
    await import('~/main')
} else {
    // Worker thread: service diff-compute requests and nothing else.
    runDiffWorker()
}
