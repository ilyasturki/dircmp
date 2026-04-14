import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { copyEntry } from '~/utils/copy'

let tmpRoot: string

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dircmp-symlink-copy-'))
})

afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
})

describe('copyEntry — symlinks', () => {
    test('copies a valid symlink preserving its raw target', () => {
        const src = path.join(tmpRoot, 'src-link')
        const dest = path.join(tmpRoot, 'dest-link')
        fs.symlinkSync('some/target/path.txt', src)

        copyEntry(src, dest, 'symlink')

        const stat = fs.lstatSync(dest)
        expect(stat.isSymbolicLink()).toBe(true)
        expect(fs.readlinkSync(dest)).toBe('some/target/path.txt')
    })

    test('copies a broken symlink without following it', () => {
        const src = path.join(tmpRoot, 'broken-link')
        const dest = path.join(tmpRoot, 'broken-dest')
        fs.symlinkSync('/does/not/exist', src)

        copyEntry(src, dest, 'symlink')

        const stat = fs.lstatSync(dest)
        expect(stat.isSymbolicLink()).toBe(true)
        expect(fs.readlinkSync(dest)).toBe('/does/not/exist')
    })

    test('copies a directory containing symlinks without dereferencing them', () => {
        const srcDir = path.join(tmpRoot, 'src-dir')
        const destDir = path.join(tmpRoot, 'dest-dir')
        fs.mkdirSync(srcDir)
        fs.writeFileSync(path.join(srcDir, 'real.txt'), 'content')
        fs.symlinkSync('real.txt', path.join(srcDir, 'link.txt'))

        copyEntry(srcDir, destDir, 'directory')

        const innerLink = path.join(destDir, 'link.txt')
        const stat = fs.lstatSync(innerLink)
        expect(stat.isSymbolicLink()).toBe(true)
        expect(fs.readlinkSync(innerLink)).toBe('real.txt')
    })
})
