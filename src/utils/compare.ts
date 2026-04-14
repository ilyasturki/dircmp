import path from 'node:path'

import type {
    CompareEntry,
    DiffStatus,
    FileEntry,
    FilterMode,
    ScanResult,
    SortDirection,
    SortMode,
} from '~/utils/types'
import { getEntriesAtPath } from '~/utils/scanner'

export interface CompareOptions {
    compareDates: boolean
    compareContents: boolean
}

export interface SortOptions {
    mode: SortMode
    direction: SortDirection
    dirsFirst: boolean
}

const defaultSortOptions: SortOptions = {
    mode: 'name',
    direction: 'asc',
    dirsFirst: true,
}

function sortEntries(entries: CompareEntry[], opts: SortOptions): void {
    const dir = opts.direction === 'asc' ? 1 : -1
    entries.sort((a, b) => {
        if (opts.dirsFirst && a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1
        }
        switch (opts.mode) {
            case 'name':
                return (
                    dir
                    * a.name.localeCompare(b.name, undefined, {
                        sensitivity: 'base',
                    })
                )
            case 'size': {
                const sizeA = Math.max(a.left?.size ?? 0, a.right?.size ?? 0)
                const sizeB = Math.max(b.left?.size ?? 0, b.right?.size ?? 0)
                if (sizeA !== sizeB) return dir * (sizeA - sizeB)
                return a.name.localeCompare(b.name, undefined, {
                    sensitivity: 'base',
                })
            }
            case 'date': {
                const dateA = Math.max(
                    a.left?.modifiedTime.getTime() ?? 0,
                    a.right?.modifiedTime.getTime() ?? 0,
                )
                const dateB = Math.max(
                    b.left?.modifiedTime.getTime() ?? 0,
                    b.right?.modifiedTime.getTime() ?? 0,
                )
                if (dateA !== dateB) return dir * (dateA - dateB)
                return a.name.localeCompare(b.name, undefined, {
                    sensitivity: 'base',
                })
            }
            case 'status': {
                const statusOrder: Record<DiffStatus, number> = {
                    'only-left': 0,
                    'only-right': 1,
                    modified: 2,
                    identical: 3,
                }
                const orderA = statusOrder[a.status]
                const orderB = statusOrder[b.status]
                if (orderA !== orderB) return dir * (orderA - orderB)
                return a.name.localeCompare(b.name, undefined, {
                    sensitivity: 'base',
                })
            }
        }
    })
}

function isFileDifferent(
    left: FileEntry,
    right: FileEntry,
    options: CompareOptions,
): boolean {
    if (left.size !== right.size) return true
    if (
        options.compareDates
        && left.modifiedTime.getTime() !== right.modifiedTime.getTime()
    )
        return true
    if (
        options.compareContents
        && left.contentHash !== null
        && right.contentHash !== null
        && left.contentHash !== right.contentHash
    )
        return true
    return false
}

const descendantFilesCache = new WeakMap<
    ScanResult,
    Map<string, Map<string, FileEntry>>
>()

function collectDescendantFiles(
    scan: ScanResult,
    dirPath: string,
): Map<string, FileEntry> {
    let scanCache = descendantFilesCache.get(scan)
    if (!scanCache) {
        scanCache = new Map()
        descendantFilesCache.set(scan, scanCache)
    }
    const cached = scanCache.get(dirPath)
    if (cached) return cached

    const prefix = dirPath === '' ? '' : dirPath + path.sep
    const bySuffix = new Map<string, FileEntry>()
    for (const [relPath, entry] of scan) {
        if (relPath.startsWith(prefix) && !entry.isDirectory) {
            bySuffix.set(relPath.slice(prefix.length), entry)
        }
    }
    scanCache.set(dirPath, bySuffix)
    return bySuffix
}

function hasDescendantDiff(
    leftScan: ScanResult,
    rightScan: ScanResult,
    leftDirPath: string,
    rightDirPath: string,
    options: CompareOptions,
): boolean {
    const leftFiles = collectDescendantFiles(leftScan, leftDirPath)
    const rightFiles = collectDescendantFiles(rightScan, rightDirPath)

    for (const [suffix, leftEntry] of leftFiles) {
        const rightEntry = rightFiles.get(suffix)
        if (!rightEntry || isFileDifferent(leftEntry, rightEntry, options))
            return true
    }

    for (const suffix of rightFiles.keys()) {
        if (!leftFiles.has(suffix)) return true
    }

    return false
}

const diffCountCache = new WeakMap<
    ScanResult,
    WeakMap<ScanResult, Map<string, number>>
>()

export function countDescendantDiffs(
    leftScan: ScanResult,
    rightScan: ScanResult,
    leftDirPath: string,
    rightDirPath: string,
    options: CompareOptions,
): number {
    let outer = diffCountCache.get(leftScan)
    if (!outer) {
        outer = new WeakMap()
        diffCountCache.set(leftScan, outer)
    }
    let inner = outer.get(rightScan)
    if (!inner) {
        inner = new Map()
        outer.set(rightScan, inner)
    }
    const key = `${leftDirPath}\0${rightDirPath}\0${options.compareDates ? '1' : '0'}${options.compareContents ? '1' : '0'}`
    const cached = inner.get(key)
    if (cached !== undefined) return cached

    const leftFiles = collectDescendantFiles(leftScan, leftDirPath)
    const rightFiles = collectDescendantFiles(rightScan, rightDirPath)
    let count = 0

    for (const [suffix, leftEntry] of leftFiles) {
        const rightEntry = rightFiles.get(suffix)
        if (!rightEntry || isFileDifferent(leftEntry, rightEntry, options)) {
            count++
        }
    }

    for (const suffix of rightFiles.keys()) {
        if (!leftFiles.has(suffix)) count++
    }

    inner.set(key, count)
    return count
}

export function compareAtPath(
    leftScan: ScanResult,
    rightScan: ScanResult,
    leftDirPath: string,
    rightDirPath: string,
    options: CompareOptions,
    sortOpts: SortOptions = defaultSortOptions,
    manualPairings?: Map<string, string>,
): CompareEntry[] {
    const leftEntries = getEntriesAtPath(leftScan, leftDirPath)
    const rightEntries = getEntriesAtPath(rightScan, rightDirPath)

    const leftMap = new Map(
        leftEntries.map((e) => [e.name + (e.isDirectory ? '/' : ''), e]),
    )
    const rightMap = new Map(
        rightEntries.map((e) => [e.name + (e.isDirectory ? '/' : ''), e]),
    )

    // Process manual pairings: find pairings relevant to this directory level
    const pairedEntries: CompareEntry[] = []
    if (manualPairings) {
        for (const [leftPath, rightPath] of manualPairings) {
            const leftParent =
                leftPath.includes('/') ?
                    leftPath.substring(0, leftPath.lastIndexOf('/'))
                :   ''
            const rightParent =
                rightPath.includes('/') ?
                    rightPath.substring(0, rightPath.lastIndexOf('/'))
                :   ''
            if (leftParent !== leftDirPath || rightParent !== rightDirPath)
                continue

            const leftName = leftPath.slice(
                leftParent ? leftParent.length + 1 : 0,
            )
            const rightName = rightPath.slice(
                rightParent ? rightParent.length + 1 : 0,
            )
            const leftKey = leftName + '/'
            const rightKey = rightName + '/'
            const left = leftMap.get(leftKey)
            const right = rightMap.get(rightKey)
            if (!left || !right) continue

            // Remove from maps so they aren't processed as unmatched
            leftMap.delete(leftKey)
            rightMap.delete(rightKey)

            const status: DiffStatus =
                (
                    hasDescendantDiff(
                        leftScan,
                        rightScan,
                        leftPath,
                        rightPath,
                        options,
                    )
                ) ?
                    'modified'
                :   'identical'

            pairedEntries.push({
                relativePath: left.relativePath,
                name: left.name,
                isDirectory: true,
                status,
                left,
                right,
                depth: 0,
                isExpanded: false,
                pairedLeftPath: leftPath,
                pairedRightPath: rightPath,
            })
        }
    }

    const samePath = leftDirPath === rightDirPath
    const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()])
    const entries: CompareEntry[] = []

    for (const key of allKeys) {
        const left = leftMap.get(key)
        const right = rightMap.get(key)
        const isDir = (left?.isDirectory ?? right?.isDirectory) as boolean
        const name = (left?.name ?? right?.name) as string
        const canonicalRelPath =
            left?.relativePath
            ?? (leftDirPath ? leftDirPath + '/' + name : name)

        // Handle same name but different types (file vs dir)
        if (left && right && left.isDirectory !== right.isDirectory) {
            entries.push({
                relativePath: left.relativePath,
                name: left.name,
                isDirectory: left.isDirectory,
                status: 'only-left',
                left,
                depth: 0,
                isExpanded: false,
            })
            entries.push({
                relativePath: canonicalRelPath,
                name: right.name,
                isDirectory: right.isDirectory,
                status: 'only-right',
                right,
                depth: 0,
                isExpanded: false,
            })
            continue
        }

        let status: DiffStatus
        if (!left) {
            status = 'only-right'
        } else if (!right) {
            status = 'only-left'
        } else if (isDir) {
            const leftPath = samePath ? canonicalRelPath : left.relativePath
            const rightPath = samePath ? canonicalRelPath : right.relativePath
            status =
                (
                    hasDescendantDiff(
                        leftScan,
                        rightScan,
                        leftPath,
                        rightPath,
                        options,
                    )
                ) ?
                    'modified'
                :   'identical'
        } else {
            status =
                isFileDifferent(left, right, options) ? 'modified' : 'identical'
        }

        entries.push({
            relativePath: canonicalRelPath,
            name,
            isDirectory: isDir,
            status,
            left,
            right,
            depth: 0,
            isExpanded: false,
        })
    }

    entries.push(...pairedEntries)

    sortEntries(entries, sortOpts)

    return entries
}

export function buildVisibleTree(
    leftScan: ScanResult,
    rightScan: ScanResult,
    expandedDirs: Set<string>,
    options: CompareOptions = { compareDates: false, compareContents: true },
    sortOpts: SortOptions = defaultSortOptions,
    manualPairings?: Map<string, string>,
): CompareEntry[] {
    const result: CompareEntry[] = []

    function walk(leftDirPath: string, rightDirPath: string, depth: number) {
        const entries = compareAtPath(
            leftScan,
            rightScan,
            leftDirPath,
            rightDirPath,
            options,
            sortOpts,
            manualPairings,
        )
        for (const entry of entries) {
            const isExpanded =
                entry.isDirectory && expandedDirs.has(entry.relativePath)
            result.push({ ...entry, depth, isExpanded })
            if (isExpanded) {
                const childLeft =
                    entry.pairedLeftPath
                    ?? (leftDirPath ?
                        leftDirPath + '/' + entry.name
                    :   entry.name)
                const childRight =
                    entry.pairedRightPath
                    ?? (rightDirPath ?
                        rightDirPath + '/' + entry.name
                    :   entry.name)
                walk(childLeft, childRight, depth + 1)
            }
        }
    }

    walk('', '', 0)
    return result
}

export function filterByMode(
    entries: CompareEntry[],
    mode: FilterMode,
): CompareEntry[] {
    if (mode === 'all') return entries

    const targetStatus: DiffStatus =
        mode === 'same' ? 'identical'
        : mode === 'modified' ? 'modified'
        : mode === 'only-left' ? 'only-left'
        : 'only-right'

    const keepPaths = new Set<string>()
    for (const entry of entries) {
        if (entry.status === targetStatus) {
            keepPaths.add(entry.relativePath)
        }
    }

    for (const relPath of [...keepPaths]) {
        const parts = relPath.split('/')
        let ancestor = ''
        for (let i = 0; i < parts.length - 1; i++) {
            ancestor = i === 0 ? parts[i]! : ancestor + '/' + parts[i]
            keepPaths.add(ancestor)
        }
    }

    return entries.filter((e) => keepPaths.has(e.relativePath))
}
