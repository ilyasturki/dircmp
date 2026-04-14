import path from 'node:path'
import { describe, expect, test } from 'bun:test'

import type { CompareEntry } from '~/utils/types'
import { compareAtPath } from '~/utils/compare'
import { scanDirectory } from '~/utils/scanner'

const ROOT = path.resolve(import.meta.dirname, '..')
const LEFT = path.join(ROOT, 'tests', 'fixtures', 'left')
const RIGHT = path.join(ROOT, 'tests', 'fixtures', 'right')

const OPTS = { compareDates: false, compareContents: true }

async function entriesAt(dirPath: string): Promise<CompareEntry[]> {
    const [leftScan, rightScan] = await Promise.all([
        scanDirectory(LEFT),
        scanDirectory(RIGHT),
    ])
    return compareAtPath(leftScan, rightScan, dirPath, dirPath, OPTS)
}

describe('compare — symlinks', () => {
    test('symlinks with identical targets are identical', async () => {
        const entries = await entriesAt('edge-cases')
        const same = entries.find((e) => e.name === 'symlink-same.ts')
        expect(same).toBeDefined()
        expect(same!.type).toBe('symlink')
        expect(same!.status).toBe('identical')
    })

    test('symlinks with different targets are modified', async () => {
        const entries = await entriesAt('edge-cases')
        const valid = entries.find((e) => e.name === 'symlink-valid.ts')
        expect(valid).toBeDefined()
        expect(valid!.type).toBe('symlink')
        expect(valid!.status).toBe('modified')
    })

    test('broken symlinks compared by target string only', async () => {
        const entries = await entriesAt('edge-cases')
        const broken = entries.find((e) => e.name === 'symlink-broken.ts')
        expect(broken).toBeDefined()
        expect(broken!.type).toBe('symlink')
        // Left target: "../src/utils/helpers.ts", Right: "nonexistent.ts"
        expect(broken!.status).toBe('modified')
    })

    test('symlink vs regular file produces two entries (type mismatch)', async () => {
        const entries = await entriesAt('edge-cases')
        const matches = entries.filter((e) => e.name === 'symlink-vs-file')
        expect(matches).toHaveLength(2)
        const statuses = matches.map((m) => m.status).sort()
        expect(statuses).toEqual(['only-left', 'only-right'])
        // Left side is the symlink, right is the regular file
        const leftOnly = matches.find((m) => m.status === 'only-left')!
        const rightOnly = matches.find((m) => m.status === 'only-right')!
        expect(leftOnly.type).toBe('symlink')
        expect(rightOnly.type).toBe('file')
    })

    test('symlink-to-directory on both sides with same target is identical', async () => {
        const entries = await entriesAt('edge-cases')
        const dir = entries.find((e) => e.name === 'symlink-to-dir')
        expect(dir).toBeDefined()
        expect(dir!.type).toBe('symlink')
        expect(dir!.status).toBe('identical')
    })
})
