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
        }
    })
}

function hasDescendantDiff(
    leftScan: ScanResult,
    rightScan: ScanResult,
    dirPath: string,
    options: CompareOptions,
): boolean {
    const prefix = dirPath === '' ? '' : dirPath + path.sep

    const leftPaths = new Set<string>()
    for (const [relPath, entry] of leftScan) {
        if (relPath.startsWith(prefix) && !entry.isDirectory) {
            leftPaths.add(relPath)
        }
    }

    const rightPaths = new Set<string>()
    for (const [relPath, entry] of rightScan) {
        if (relPath.startsWith(prefix) && !entry.isDirectory) {
            rightPaths.add(relPath)
        }
    }

    for (const p of leftPaths) {
        const rightEntry = rightScan.get(p)
        if (!rightEntry) return true
        const leftEntry = leftScan.get(p)!
        if (leftEntry.size !== rightEntry.size) return true
        if (
            options.compareDates
            && leftEntry.modifiedTime.getTime()
                !== rightEntry.modifiedTime.getTime()
        )
            return true
        if (
            options.compareContents
            && leftEntry.contentHash !== null
            && rightEntry.contentHash !== null
            && leftEntry.contentHash !== rightEntry.contentHash
        )
            return true
    }

    for (const p of rightPaths) {
        if (!leftPaths.has(p)) return true
    }

    return false
}

export function countDescendantDiffs(
    leftScan: ScanResult,
    rightScan: ScanResult,
    dirPath: string,
    options: CompareOptions,
): number {
    const prefix = dirPath === '' ? '' : dirPath + path.sep
    let count = 0

    const leftPaths = new Set<string>()
    for (const [relPath, entry] of leftScan) {
        if (relPath.startsWith(prefix) && !entry.isDirectory) {
            leftPaths.add(relPath)
        }
    }

    const rightPaths = new Set<string>()
    for (const [relPath, entry] of rightScan) {
        if (relPath.startsWith(prefix) && !entry.isDirectory) {
            rightPaths.add(relPath)
        }
    }

    for (const p of leftPaths) {
        const rightEntry = rightScan.get(p)
        if (!rightEntry) {
            count++
            continue
        }
        const leftEntry = leftScan.get(p)!
        if (
            leftEntry.size !== rightEntry.size
            || (options.compareDates
                && leftEntry.modifiedTime.getTime()
                    !== rightEntry.modifiedTime.getTime())
            || (options.compareContents
                && leftEntry.contentHash !== null
                && rightEntry.contentHash !== null
                && leftEntry.contentHash !== rightEntry.contentHash)
        ) {
            count++
        }
    }

    for (const p of rightPaths) {
        if (!leftPaths.has(p)) count++
    }

    return count
}

function hasDescendantDiffCrossPath(
    leftScan: ScanResult,
    rightScan: ScanResult,
    leftDirPath: string,
    rightDirPath: string,
    options: CompareOptions,
): boolean {
    const leftPrefix = leftDirPath === '' ? '' : leftDirPath + path.sep
    const rightPrefix = rightDirPath === '' ? '' : rightDirPath + path.sep

    const leftBySuffix = new Map<string, FileEntry>()
    for (const [relPath, entry] of leftScan) {
        if (relPath.startsWith(leftPrefix) && !entry.isDirectory) {
            leftBySuffix.set(relPath.slice(leftPrefix.length), entry)
        }
    }

    const rightBySuffix = new Map<string, FileEntry>()
    for (const [relPath, entry] of rightScan) {
        if (relPath.startsWith(rightPrefix) && !entry.isDirectory) {
            rightBySuffix.set(relPath.slice(rightPrefix.length), entry)
        }
    }

    for (const [suffix, leftEntry] of leftBySuffix) {
        const rightEntry = rightBySuffix.get(suffix)
        if (!rightEntry) return true
        if (leftEntry.size !== rightEntry.size) return true
        if (
            options.compareDates
            && leftEntry.modifiedTime.getTime()
                !== rightEntry.modifiedTime.getTime()
        )
            return true
        if (
            options.compareContents
            && leftEntry.contentHash !== null
            && rightEntry.contentHash !== null
            && leftEntry.contentHash !== rightEntry.contentHash
        )
            return true
    }

    for (const suffix of rightBySuffix.keys()) {
        if (!leftBySuffix.has(suffix)) return true
    }

    return false
}

export function countDescendantDiffsCrossPath(
    leftScan: ScanResult,
    rightScan: ScanResult,
    leftDirPath: string,
    rightDirPath: string,
    options: CompareOptions,
): number {
    const leftPrefix = leftDirPath === '' ? '' : leftDirPath + path.sep
    const rightPrefix = rightDirPath === '' ? '' : rightDirPath + path.sep
    let count = 0

    const leftBySuffix = new Map<string, FileEntry>()
    for (const [relPath, entry] of leftScan) {
        if (relPath.startsWith(leftPrefix) && !entry.isDirectory) {
            leftBySuffix.set(relPath.slice(leftPrefix.length), entry)
        }
    }

    const rightBySuffix = new Map<string, FileEntry>()
    for (const [relPath, entry] of rightScan) {
        if (relPath.startsWith(rightPrefix) && !entry.isDirectory) {
            rightBySuffix.set(relPath.slice(rightPrefix.length), entry)
        }
    }

    for (const [suffix, leftEntry] of leftBySuffix) {
        const rightEntry = rightBySuffix.get(suffix)
        if (!rightEntry) {
            count++
            continue
        }
        if (
            leftEntry.size !== rightEntry.size
            || (options.compareDates
                && leftEntry.modifiedTime.getTime()
                    !== rightEntry.modifiedTime.getTime())
            || (options.compareContents
                && leftEntry.contentHash !== null
                && rightEntry.contentHash !== null
                && leftEntry.contentHash !== rightEntry.contentHash)
        ) {
            count++
        }
    }

    for (const suffix of rightBySuffix.keys()) {
        if (!leftBySuffix.has(suffix)) count++
    }

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
                    hasDescendantDiffCrossPath(
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
            if (samePath) {
                status =
                    (
                        hasDescendantDiff(
                            leftScan,
                            rightScan,
                            canonicalRelPath,
                            options,
                        )
                    ) ?
                        'modified'
                    :   'identical'
            } else {
                status =
                    (
                        hasDescendantDiffCrossPath(
                            leftScan,
                            rightScan,
                            left.relativePath,
                            right.relativePath,
                            options,
                        )
                    ) ?
                        'modified'
                    :   'identical'
            }
        } else {
            const sizeMatch = left.size === right.size
            const dateMatch =
                !options.compareDates
                || left.modifiedTime.getTime() === right.modifiedTime.getTime()
            const contentMatch =
                !options.compareContents
                || left.contentHash === null
                || right.contentHash === null
                || left.contentHash === right.contentHash
            status =
                sizeMatch && dateMatch && contentMatch ?
                    'identical'
                :   'modified'
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
    filterMode: FilterMode = 'all',
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
            if (filterMode === 'diff-only' && entry.status === 'identical') {
                continue
            }
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
