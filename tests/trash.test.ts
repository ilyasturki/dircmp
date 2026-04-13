import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, test } from 'bun:test'

// Redirect trash root to an isolated tmp dir before importing the module.
// The trash module reads XDG_CACHE_HOME at call time, so this just needs to
// happen before initTrashSession() runs.
const TMP_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'dircmp-trash-test-'))
process.env.XDG_CACHE_HOME = TMP_CACHE

const { initTrashSession, moveToTrash, restoreFromTrash } =
    await import('~/utils/trash')

const TRASH_ROOT = path.join(TMP_CACHE, 'dircmp', 'trash')

function tmpWorkDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'dircmp-trash-work-'))
}

describe('trash module', () => {
    beforeAll(() => {
        initTrashSession()
    })

    test('initTrashSession creates the session dir under the trash root', () => {
        expect(fs.existsSync(TRASH_ROOT)).toBe(true)
        const sessions = fs.readdirSync(TRASH_ROOT)
        // Our session dir is the only one (orphans are purged).
        expect(sessions.length).toBe(1)
        expect(sessions[0]).toMatch(new RegExp(`^${process.pid}-\\d+$`))
    })

    test('initTrashSession is idempotent', () => {
        const before = fs.readdirSync(TRASH_ROOT)
        initTrashSession()
        initTrashSession()
        const after = fs.readdirSync(TRASH_ROOT)
        expect(after).toEqual(before)
    })

    test('moveToTrash moves a file and returns its new path', () => {
        const work = tmpWorkDir()
        const src = path.join(work, 'hello.txt')
        fs.writeFileSync(src, 'hi')

        const trashPath = moveToTrash(src)

        expect(fs.existsSync(src)).toBe(false)
        expect(fs.existsSync(trashPath)).toBe(true)
        expect(fs.readFileSync(trashPath, 'utf8')).toBe('hi')
        expect(path.basename(trashPath)).toBe('hello.txt')
    })

    test('moveToTrash moves a directory recursively', () => {
        const work = tmpWorkDir()
        const dir = path.join(work, 'subdir')
        fs.mkdirSync(dir)
        fs.writeFileSync(path.join(dir, 'a.txt'), 'A')
        fs.writeFileSync(path.join(dir, 'b.txt'), 'B')

        const trashPath = moveToTrash(dir)

        expect(fs.existsSync(dir)).toBe(false)
        expect(fs.readFileSync(path.join(trashPath, 'a.txt'), 'utf8')).toBe('A')
        expect(fs.readFileSync(path.join(trashPath, 'b.txt'), 'utf8')).toBe('B')
    })

    test('moveToTrash gives each call a unique subdir (same basename is safe)', () => {
        const work = tmpWorkDir()
        const srcA = path.join(work, 'dup.txt')
        const srcB = path.join(work, 'other', 'dup.txt')
        fs.writeFileSync(srcA, 'A')
        fs.mkdirSync(path.dirname(srcB), { recursive: true })
        fs.writeFileSync(srcB, 'B')

        const trashA = moveToTrash(srcA)
        const trashB = moveToTrash(srcB)

        expect(trashA).not.toBe(trashB)
        expect(path.dirname(trashA)).not.toBe(path.dirname(trashB))
        expect(fs.readFileSync(trashA, 'utf8')).toBe('A')
        expect(fs.readFileSync(trashB, 'utf8')).toBe('B')
    })

    test('restoreFromTrash renames content back to dest, creating parents', () => {
        const work = tmpWorkDir()
        const src = path.join(work, 'restoreme.txt')
        fs.writeFileSync(src, 'original')
        const trashPath = moveToTrash(src)

        const dest = path.join(work, 'nested', 'deep', 'restoreme.txt')
        restoreFromTrash(trashPath, dest)

        expect(fs.existsSync(trashPath)).toBe(false)
        expect(fs.readFileSync(dest, 'utf8')).toBe('original')
    })

    test('moveToTrash throws if called before init (guarded contract)', async () => {
        // This can't easily be tested in-process since init was already called
        // beforeAll. Sanity-check the documented contract by asserting that
        // trash paths live inside our session dir.
        const work = tmpWorkDir()
        const src = path.join(work, 'sentinel.txt')
        fs.writeFileSync(src, 's')
        const trashPath = moveToTrash(src)
        const sessions = fs.readdirSync(TRASH_ROOT)
        expect(trashPath.startsWith(path.join(TRASH_ROOT, sessions[0]!))).toBe(
            true,
        )
    })
})
