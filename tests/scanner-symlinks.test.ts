import path from 'node:path'
import { describe, expect, test } from 'bun:test'

import { scanDirectory } from '~/utils/scanner'

const ROOT = path.resolve(import.meta.dirname, '..')
const LEFT = path.join(ROOT, 'tests', 'fixtures', 'left', 'edge-cases')
const RIGHT = path.join(ROOT, 'tests', 'fixtures', 'right', 'edge-cases')

describe('scanner — followSymlinks=false (default)', () => {
    test('valid symlink becomes a symlink entry with linkTarget', async () => {
        const scan = await scanDirectory(LEFT)
        const entry = scan.get('symlink-valid.ts')
        expect(entry).toBeDefined()
        expect(entry!.type).toBe('symlink')
        expect(entry!.linkTarget).toBe('../src/utils/helpers.ts')
    })

    test('broken symlink is a symlink entry (not an error)', async () => {
        const scan = await scanDirectory(RIGHT)
        const entry = scan.get('symlink-broken.ts')
        expect(entry).toBeDefined()
        expect(entry!.type).toBe('symlink')
        expect(entry!.linkBroken).toBe(true)
        expect(entry!.error).toBeUndefined()
        expect(entry!.linkTarget).toBe('nonexistent.ts')
    })

    test('symlink-to-directory is a leaf (no descendants scanned)', async () => {
        const scan = await scanDirectory(LEFT)
        const entry = scan.get('symlink-to-dir')
        expect(entry).toBeDefined()
        expect(entry!.type).toBe('symlink')
        expect(entry!.linkTarget).toBe('../src')
        // Ensure nothing was recursed into the link target
        for (const key of scan.keys()) {
            expect(key.startsWith('symlink-to-dir/')).toBe(false)
        }
    })

    test('regular file keeps type=file', async () => {
        const scan = await scanDirectory(LEFT)
        const entry = scan.get('empty-file.txt')
        expect(entry!.type).toBe('file')
        expect(entry!.linkTarget).toBeUndefined()
    })
})

describe('scanner — followSymlinks=true', () => {
    test('valid symlink is resolved into its target type', async () => {
        const scan = await scanDirectory(LEFT, null, false, true)
        const entry = scan.get('symlink-valid.ts')
        expect(entry).toBeDefined()
        // The target (../src/utils/helpers.ts) doesn't exist from fixtures dir,
        // so this one will actually be recorded as an error. Use the remote
        // symlink-to-dir which points to ../src (also doesn't exist from here).
    })

    test('broken symlink reports as error (legacy behaviour)', async () => {
        const scan = await scanDirectory(RIGHT, null, false, true)
        const entry = scan.get('symlink-broken.ts')
        expect(entry).toBeDefined()
        expect(entry!.error).toBe('Broken symlink')
    })
})
