import fsp from 'node:fs/promises'
import path from 'node:path'

import type { FileEntry, ScanResult } from '~/utils/types'

const STAT_CONCURRENCY = 64

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
    | { kind: 'error'; entry: import('fs').Dirent; code: string }
    | { kind: 'skip' }

async function statEntry(
    entry: import('fs').Dirent,
    fullPath: string,
): Promise<StatResult> {
    let isDirectory = entry.isDirectory()
    let resolvedPath = fullPath

    if (entry.isSymbolicLink()) {
        try {
            resolvedPath = await fsp.realpath(fullPath)
            const stat = await fsp.stat(resolvedPath)
            isDirectory = stat.isDirectory()
            if (isDirectory) {
                return { kind: 'directory', entry, fullPath, stat }
            }
            return { kind: 'file', entry, resolvedPath, stat }
        } catch {
            return { kind: 'error', entry, code: 'Broken symlink' }
        }
    }

    if (isDirectory) {
        const stat = await fsp.stat(fullPath)
        return { kind: 'directory', entry, fullPath, stat }
    }

    const stat = await fsp.stat(resolvedPath)
    return { kind: 'file', entry, resolvedPath, stat }
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
                isDirectory: true,
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
        if (shouldIgnore && shouldIgnore(relativePath)) continue
        filtered.push({ dirent, fullPath, relativePath })
    }

    // Phase 1: stat all entries in parallel
    const statResults = await mapConcurrent(
        filtered,
        STAT_CONCURRENCY,
        async (item) => {
            try {
                return await statEntry(item.dirent, item.fullPath)
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
                    isDirectory: false,
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
                    isDirectory: false,
                    size,
                    modifiedTime: sr.stat.mtime,
                    contentHash: null,
                })
                break
            }
            case 'directory': {
                result.set(item.relativePath, {
                    name: sr.entry.name,
                    relativePath: item.relativePath,
                    isDirectory: true,
                    size: 0,
                    modifiedTime: sr.stat.mtime,
                    contentHash: null,
                })
                const subtreeSize = await walkDirectory(
                    rootPath,
                    sr.fullPath,
                    result,
                    shouldIgnore,
                )
                const dirEntry = result.get(item.relativePath)!
                dirEntry.size = subtreeSize
                totalSize += subtreeSize
                break
            }
        }
    }

    return totalSize
}

export async function scanDirectory(
    rootPath: string,
    shouldIgnore: ((relativePath: string) => boolean) | null = null,
): Promise<ScanResult> {
    const result: ScanResult = new Map()
    await walkDirectory(rootPath, rootPath, result, shouldIgnore)
    return result
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
