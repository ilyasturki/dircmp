import path from 'node:path'

import type {
    CompareEntry,
    DiffStatus,
    FilterMode,
    ScanResult,
} from '~/utils/types'
import { getEntriesAtPath } from '~/utils/scanner'

export interface CompareOptions {
    compareDates: boolean
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
        ) {
            count++
        }
    }

    for (const p of rightPaths) {
        if (!leftPaths.has(p)) count++
    }

    return count
}

export function compareAtPath(
    leftScan: ScanResult,
    rightScan: ScanResult,
    dirPath: string,
    options: CompareOptions,
): CompareEntry[] {
    const leftEntries = getEntriesAtPath(leftScan, dirPath)
    const rightEntries = getEntriesAtPath(rightScan, dirPath)

    const leftMap = new Map(
        leftEntries.map((e) => [e.name + (e.isDirectory ? '/' : ''), e]),
    )
    const rightMap = new Map(
        rightEntries.map((e) => [e.name + (e.isDirectory ? '/' : ''), e]),
    )

    const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()])
    const entries: CompareEntry[] = []

    for (const key of allKeys) {
        const left = leftMap.get(key)
        const right = rightMap.get(key)
        const isDir = (left?.isDirectory ?? right?.isDirectory) as boolean
        const name = (left?.name ?? right?.name) as string
        const relativePath = (left?.relativePath
            ?? right?.relativePath) as string

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
                relativePath: right.relativePath,
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
            status =
                hasDescendantDiff(leftScan, rightScan, relativePath, options) ?
                    'modified'
                :   'identical'
        } else {
            const sizeMatch = left.size === right.size
            const dateMatch =
                !options.compareDates
                || left.modifiedTime.getTime() === right.modifiedTime.getTime()
            status = sizeMatch && dateMatch ? 'identical' : 'modified'
        }

        entries.push({
            relativePath,
            name,
            isDirectory: isDir,
            status,
            left,
            right,
            depth: 0,
            isExpanded: false,
        })
    }

    entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    return entries
}

export function buildVisibleTree(
    leftScan: ScanResult,
    rightScan: ScanResult,
    expandedDirs: Set<string>,
    filterMode: FilterMode = 'all',
    options: CompareOptions = { compareDates: false },
): CompareEntry[] {
    const result: CompareEntry[] = []

    function walk(dirPath: string, depth: number) {
        const entries = compareAtPath(leftScan, rightScan, dirPath, options)
        for (const entry of entries) {
            if (filterMode === 'diff-only' && entry.status === 'identical') {
                continue
            }
            const isExpanded =
                entry.isDirectory && expandedDirs.has(entry.relativePath)
            result.push({ ...entry, depth, isExpanded })
            if (isExpanded) {
                walk(entry.relativePath, depth + 1)
            }
        }
    }

    walk('', 0)
    return result
}
