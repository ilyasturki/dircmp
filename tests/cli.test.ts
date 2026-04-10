import path from 'node:path'
import { describe, expect, test } from 'bun:test'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA_LEFT = path.join(ROOT, 'data', 'left')
const DATA_RIGHT = path.join(ROOT, 'data', 'right')

interface RunResult {
    stdout: string
    stderr: string
    exitCode: number
}

async function run(...args: string[]): Promise<RunResult> {
    const proc = Bun.spawn(['bun', 'run', 'tsx', 'src/index.tsx', ...args], {
        cwd: ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
    })
    const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
    ])
    const exitCode = await proc.exited
    return { stdout, stderr, exitCode }
}

// ---------------------------------------------------------------------------
// diff --format json
// ---------------------------------------------------------------------------
describe('diff --format json', () => {
    test('returns valid JSON array of diff entries', async () => {
        const { stdout, exitCode } = await run(
            'diff',
            '--format',
            'json',
            DATA_LEFT,
            DATA_RIGHT,
        )
        expect(exitCode).toBe(0)
        const entries = JSON.parse(stdout)
        expect(Array.isArray(entries)).toBe(true)
        expect(entries.length).toBeGreaterThan(0)
    })

    test('each entry has required fields', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        for (const entry of entries) {
            expect(entry).toHaveProperty('path')
            expect(entry).toHaveProperty('status')
            expect(entry).toHaveProperty('isDirectory')
            expect(['modified', 'only-left', 'only-right']).toContain(
                entry.status,
            )
        }
    })

    test('modified entries have leftSize and rightSize', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        const modified = entries.filter(
            (e: { status: string }) => e.status === 'modified',
        )
        expect(modified.length).toBeGreaterThan(0)
        for (const entry of modified) {
            expect(typeof entry.leftSize).toBe('number')
            expect(typeof entry.rightSize).toBe('number')
        }
    })

    test('only-left entries have leftSize but not rightSize', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        const leftOnly = entries.filter(
            (e: { status: string }) => e.status === 'only-left',
        )
        expect(leftOnly.length).toBeGreaterThan(0)
        for (const entry of leftOnly) {
            expect(typeof entry.leftSize).toBe('number')
            expect(entry.rightSize).toBeUndefined()
        }
    })

    test('only-right entries have rightSize but not leftSize', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        const rightOnly = entries.filter(
            (e: { status: string }) => e.status === 'only-right',
        )
        expect(rightOnly.length).toBeGreaterThan(0)
        for (const entry of rightOnly) {
            expect(typeof entry.rightSize).toBe('number')
            expect(entry.leftSize).toBeUndefined()
        }
    })

    test('no identical entries are included', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        const identical = entries.filter(
            (e: { status: string }) => e.status === 'identical',
        )
        expect(identical.length).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// diff --stat
// ---------------------------------------------------------------------------
describe('diff --stat', () => {
    test('outputs summary line with counts', async () => {
        const { stdout, exitCode } = await run(
            'diff',
            '--stat',
            DATA_LEFT,
            DATA_RIGHT,
        )
        expect(exitCode).toBe(0)
        const line = stdout.trim()
        expect(line).toMatch(/\d+ modified/)
        expect(line).toMatch(/\d+ only in left/)
        expect(line).toMatch(/\d+ only in right/)
    })
})

// ---------------------------------------------------------------------------
// diff --only filters
// ---------------------------------------------------------------------------
describe('diff --only filters', () => {
    test('--only modified returns only modified entries', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            '--only',
            'modified',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        expect(entries.length).toBeGreaterThan(0)
        for (const entry of entries) {
            expect(entry.status).toBe('modified')
        }
    })

    test('--only left-only returns only left-only entries', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            '--only',
            'left-only',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        expect(entries.length).toBeGreaterThan(0)
        for (const entry of entries) {
            expect(entry.status).toBe('only-left')
        }
    })

    test('--only right-only returns only right-only entries', async () => {
        const { stdout } = await run(
            'diff',
            '--format',
            'json',
            '--only',
            'right-only',
            DATA_LEFT,
            DATA_RIGHT,
        )
        const entries = JSON.parse(stdout)
        expect(entries.length).toBeGreaterThan(0)
        for (const entry of entries) {
            expect(entry.status).toBe('only-right')
        }
    })
})

// ---------------------------------------------------------------------------
// diff --format flat
// ---------------------------------------------------------------------------
describe('diff --format flat', () => {
    test('outputs one line per entry with status symbol prefix', async () => {
        const { stdout, exitCode } = await run(
            'diff',
            '--format',
            'flat',
            DATA_LEFT,
            DATA_RIGHT,
        )
        expect(exitCode).toBe(0)
        const lines = stdout.trim().split('\n')
        expect(lines.length).toBeGreaterThan(0)
        // Strip ANSI escape codes and check each line starts with M, -, or +
        for (const line of lines) {
            const clean = line.replace(/\x1b\[[0-9;]*m/g, '')
            expect(clean).toMatch(/^[M\-+] /)
        }
    })
})

// ---------------------------------------------------------------------------
// check (exit codes)
// ---------------------------------------------------------------------------
describe('check', () => {
    test('exits 1 when directories differ', async () => {
        const { exitCode } = await run('check', DATA_LEFT, DATA_RIGHT)
        expect(exitCode).toBe(1)
    })

    test('exits 0 when directories are identical', async () => {
        const { exitCode } = await run('check', DATA_LEFT, DATA_LEFT)
        expect(exitCode).toBe(0)
    })

    test('--stat prints summary when directories differ', async () => {
        const { stdout, exitCode } = await run(
            'check',
            '--stat',
            DATA_LEFT,
            DATA_RIGHT,
        )
        expect(exitCode).toBe(1)
        const line = stdout.trim()
        expect(line).toMatch(/\d+ modified/)
    })

    test('--stat prints Identical when directories match', async () => {
        const { stdout, exitCode } = await run(
            'check',
            '--stat',
            DATA_LEFT,
            DATA_LEFT,
        )
        expect(exitCode).toBe(0)
        expect(stdout.trim()).toBe('Identical')
    })
})

// ---------------------------------------------------------------------------
// error handling
// ---------------------------------------------------------------------------
describe('error handling', () => {
    test('exits with error for nonexistent directory', async () => {
        const { stderr, exitCode } = await run(
            'diff',
            '/tmp/does-not-exist-dircmp',
            DATA_RIGHT,
        )
        expect(exitCode).not.toBe(0)
        expect(stderr).toMatch(/not found|not a directory/i)
    })

    test('exits with error for invalid --only value', async () => {
        const { stderr, exitCode } = await run(
            'diff',
            '--only',
            'invalid',
            DATA_LEFT,
            DATA_RIGHT,
        )
        expect(exitCode).not.toBe(0)
        expect(stderr).toMatch(/invalid/i)
    })
})
