import { createHash } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import type { FileEntry, ScanResult } from '~/utils/types'

const STAT_CONCURRENCY = 64

async function computeFileHash(filePath: string): Promise<string> {
    const content = await fsp.readFile(filePath)
    return createHash('sha256').update(content).digest('hex')
}

type StatResult =
    | {
          kind: 'file'
          entry: import('fs').Dirent
          resolvedPath: string
          stat: import('fs').Stats
      }
    | {
          kind: 'directory'
          entry: import('fs').Dirent
          fullPath: string
          stat: import('fs').Stats
      }
    | {
          kind: 'symlink'
          entry: import('fs').Dirent
          fullPath: string
          linkTarget: string
          stat: import('fs').Stats | null
          broken: boolean
      }
    | { kind: 'error'; entry: import('fs').Dirent; code: string }
    | { kind: 'skip' }

async function statEntry(
    entry: import('fs').Dirent,
    fullPath: string,
    followSymlinks: boolean,
): Promise<StatResult> {
    if (entry.isSymbolicLink()) {
        if (followSymlinks) {
            try {
                const resolvedPath = await fsp.realpath(fullPath)
                const stat = await fsp.stat(resolvedPath)
                if (stat.isDirectory()) {
                    return { kind: 'directory', entry, fullPath, stat }
                }
                return { kind: 'file', entry, resolvedPath, stat }
            } catch {
                return { kind: 'error', entry, code: 'Broken symlink' }
            }
        }

        let linkTarget = ''
        try {
            linkTarget = await fsp.readlink(fullPath)
        } catch {
            // readlink failed — treat as a broken/unreadable link
        }
        let lstatResult: import('fs').Stats | null = null
        try {
            lstatResult = await fsp.lstat(fullPath)
        } catch {
            // lstat failed — leave null
        }
        let broken = false
        try {
            await fsp.stat(fullPath)
        } catch {
            broken = true
        }
        return {
            kind: 'symlink',
            entry,
            fullPath,
            linkTarget,
            stat: lstatResult,
            broken,
        }
    }

    if (entry.isDirectory()) {
        const stat = await fsp.stat(fullPath)
        return { kind: 'directory', entry, fullPath, stat }
    }

    const stat = await fsp.stat(fullPath)
    return { kind: 'file', entry, resolvedPath: fullPath, stat }
}

async function mapConcurrent<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length)
    let index = 0
    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
            while (index < items.length) {
                const i = index++
                results[i] = await fn(items[i]!)
            }
        },
    )
    await Promise.all(workers)
    return results
}

async function walkDirectory(
    rootPath: string,
    currentPath: string,
    result: ScanResult,
    shouldIgnore: ((relativePath: string) => boolean) | null,
    computeHash: boolean = false,
    followSymlinks: boolean = false,
): Promise<number> {
    let dirents
    try {
        dirents = await fsp.readdir(currentPath, { withFileTypes: true })
    } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'EACCES' || code === 'EPERM') {
            const relativePath = path.relative(rootPath, currentPath)
            result.set(relativePath, {
                name: path.basename(currentPath),
                relativePath,
                type: 'directory',
                size: 0,
                modifiedTime: new Date(),
                contentHash: null,
                error: `Permission denied: ${code}`,
            })
            return 0
        }
        throw err
    }

    // Filter ignored entries and build full paths
    const filtered: {
        dirent: import('fs').Dirent
        fullPath: string
        relativePath: string
    }[] = []
    for (const dirent of dirents) {
        const fullPath = path.join(currentPath, dirent.name)
        const relativePath = path.relative(rootPath, fullPath)
        if (
            shouldIgnore
            && shouldIgnore(
                dirent.isDirectory() ? relativePath + '/' : relativePath,
            )
        )
            continue
        filtered.push({ dirent, fullPath, relativePath })
    }

    // Phase 1: stat all entries in parallel
    const statResults = await mapConcurrent(
        filtered,
        STAT_CONCURRENCY,
        async (item) => {
            try {
                return await statEntry(
                    item.dirent,
                    item.fullPath,
                    followSymlinks,
                )
            } catch (err: unknown) {
                const code = (err as NodeJS.ErrnoException).code
                if (code === 'EACCES' || code === 'EPERM') {
                    return {
                        kind: 'error' as const,
                        entry: item.dirent,
                        code: `Permission denied: ${code}`,
                    }
                }
                throw err
            }
        },
    )

    // Phase 1.5: compute hashes for files in parallel
    const hashResults = new Map<number, string>()
    if (computeHash) {
        const fileIndices: number[] = []
        for (let i = 0; i < statResults.length; i++) {
            if (statResults[i]!.kind === 'file') {
                fileIndices.push(i)
            }
        }
        await mapConcurrent(fileIndices, STAT_CONCURRENCY, async (idx) => {
            const sr = statResults[idx]! as Extract<
                StatResult,
                { kind: 'file' }
            >
            try {
                const hash = await computeFileHash(sr.resolvedPath)
                hashResults.set(idx, hash)
            } catch {
                // Unreadable file — leave hash as null
            }
        })
    }

    // Phase 2: process results sequentially, recurse into directories
    let totalSize = 0
    for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i]!
        const sr = statResults[i]!

        switch (sr.kind) {
            case 'skip':
                break
            case 'error':
                result.set(item.relativePath, {
                    name: sr.entry.name,
                    relativePath: item.relativePath,
                    type: 'file',
                    size: 0,
                    modifiedTime: new Date(),
                    contentHash: null,
                    error: sr.code,
                })
                break
            case 'file': {
                const size = sr.stat.size
                totalSize += size
                result.set(item.relativePath, {
                    name: sr.entry.name,
                    relativePath: item.relativePath,
                    type: 'file',
                    size,
                    modifiedTime: sr.stat.mtime,
                    contentHash: hashResults.get(i) ?? null,
                })
                break
            }
            case 'directory': {
                result.set(item.relativePath, {
                    name: sr.entry.name,
                    relativePath: item.relativePath,
                    type: 'directory',
                    size: 0,
                    modifiedTime: sr.stat.mtime,
                    contentHash: null,
                })
                const subtreeSize = await walkDirectory(
                    rootPath,
                    sr.fullPath,
                    result,
                    shouldIgnore,
                    computeHash,
                    followSymlinks,
                )
                const dirEntry = result.get(item.relativePath)!
                dirEntry.size = subtreeSize
                totalSize += subtreeSize
                break
            }
            case 'symlink': {
                result.set(item.relativePath, {
                    name: sr.entry.name,
                    relativePath: item.relativePath,
                    type: 'symlink',
                    size: sr.stat?.size ?? 0,
                    modifiedTime: sr.stat?.mtime ?? new Date(0),
                    contentHash: null,
                    linkTarget: sr.linkTarget,
                    linkBroken: sr.broken,
                })
                break
            }
        }
    }

    return totalSize
}

export async function scanDirectory(
    rootPath: string,
    shouldIgnore: ((relativePath: string) => boolean) | null = null,
    computeHash: boolean = false,
    followSymlinks: boolean = false,
): Promise<ScanResult> {
    const result: ScanResult = new Map()
    await walkDirectory(
        rootPath,
        rootPath,
        result,
        shouldIgnore,
        computeHash,
        followSymlinks,
    )
    return result
}

export function statFileEntrySync(
    rootDir: string,
    relativePath: string,
    computeHash: boolean,
    followSymlinks: boolean,
): FileEntry | null {
    const fullPath = path.join(rootDir, relativePath)
    const name = path.basename(fullPath)

    let lstat: fs.Stats
    try {
        lstat = fs.lstatSync(fullPath)
    } catch {
        return null
    }

    if (lstat.isSymbolicLink()) {
        if (followSymlinks) {
            try {
                const resolvedPath = fs.realpathSync(fullPath)
                const stat = fs.statSync(resolvedPath)
                if (stat.isDirectory()) {
                    return {
                        name,
                        relativePath,
                        type: 'directory',
                        size: 0,
                        modifiedTime: stat.mtime,
                        contentHash: null,
                    }
                }
                let contentHash: string | null = null
                if (computeHash) {
                    try {
                        const content = fs.readFileSync(resolvedPath)
                        contentHash = createHash('sha256')
                            .update(content)
                            .digest('hex')
                    } catch {
                        // unreadable — leave null
                    }
                }
                return {
                    name,
                    relativePath,
                    type: 'file',
                    size: stat.size,
                    modifiedTime: stat.mtime,
                    contentHash,
                }
            } catch {
                return null
            }
        }

        let linkTarget = ''
        try {
            linkTarget = fs.readlinkSync(fullPath)
        } catch {
            // readlink failed — treat as broken
        }
        let broken = false
        try {
            fs.statSync(fullPath)
        } catch {
            broken = true
        }
        return {
            name,
            relativePath,
            type: 'symlink',
            size: lstat.size,
            modifiedTime: lstat.mtime,
            contentHash: null,
            linkTarget,
            linkBroken: broken,
        }
    }

    if (lstat.isDirectory()) {
        return {
            name,
            relativePath,
            type: 'directory',
            size: 0,
            modifiedTime: lstat.mtime,
            contentHash: null,
        }
    }

    if (!lstat.isFile()) return null

    let contentHash: string | null = null
    if (computeHash) {
        try {
            const content = fs.readFileSync(fullPath)
            contentHash = createHash('sha256').update(content).digest('hex')
        } catch {
            // unreadable — leave null
        }
    }
    return {
        name,
        relativePath,
        type: 'file',
        size: lstat.size,
        modifiedTime: lstat.mtime,
        contentHash,
    }
}

export function getEntriesAtPath(
    scan: ScanResult,
    dirPath: string,
): FileEntry[] {
    const entries: FileEntry[] = []
    for (const [relPath, entry] of scan) {
        const parent = path.dirname(relPath)
        const normalizedDir = dirPath === '' ? '.' : dirPath
        if (parent === normalizedDir && relPath !== dirPath) {
            entries.push(entry)
        }
    }
    return entries
}
