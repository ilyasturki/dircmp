import path from 'node:path'

import type { CliIgnoreOptions } from '~/cli/types'
import type { CompareEntry, DiffStatus, ScanResult } from '~/utils/types'
import { compareAtPath } from '~/utils/compare'
import { formatSize } from '~/utils/format-size'
import { cliScan } from './scan'

interface DiffOptions {
    format: 'tree' | 'flat' | 'json'
    only?: 'modified' | 'only-left' | 'only-right'
    stat: boolean
}

type DiffFilter = DiffOptions['only']

function collectAllEntries(
    leftScan: ScanResult,
    rightScan: ScanResult,
    dirPath: string,
    depth: number,
    filter: DiffFilter,
): CompareEntry[] {
    const entries = compareAtPath(leftScan, rightScan, dirPath)
    const result: CompareEntry[] = []

    for (const entry of entries) {
        if (entry.status === 'identical') continue
        if (filter && entry.status !== filter) continue

        result.push({ ...entry, depth })

        if (entry.isDirectory) {
            const children = collectAllEntries(
                leftScan,
                rightScan,
                entry.relativePath,
                depth + 1,
                filter,
            )
            result.push(...children)
        }
    }

    return result
}

function statusSymbol(status: DiffStatus): string {
    switch (status) {
        case 'modified':
            return 'M'
        case 'only-left':
            return '-'
        case 'only-right':
            return '+'
        case 'identical':
            return ' '
    }
}

function statusColor(status: DiffStatus): string {
    switch (status) {
        case 'modified':
            return '\x1b[33m' // yellow
        case 'only-left':
            return '\x1b[31m' // red
        case 'only-right':
            return '\x1b[32m' // green
        case 'identical':
            return ''
    }
}

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

function formatTree(
    entries: CompareEntry[],
    leftDir: string,
    rightDir: string,
): string {
    const lines: string[] = []

    lines.push(
        `${BOLD}${leftDir}${RESET}  ${DIM}↔${RESET}  ${BOLD}${rightDir}${RESET}`,
    )
    lines.push('')

    for (const entry of entries) {
        const indent = '  '.repeat(entry.depth)
        const sym = statusSymbol(entry.status)
        const color = statusColor(entry.status)
        const suffix = entry.isDirectory ? '/' : ''
        const name = entry.name + suffix

        let detail = ''
        if (!entry.isDirectory) {
            if (entry.status === 'modified' && entry.left && entry.right) {
                detail = `${DIM}(${formatSize(entry.left.size).trim()} → ${formatSize(entry.right.size).trim()})${RESET}`
            } else if (entry.status === 'only-left' && entry.left) {
                detail = `${DIM}(${formatSize(entry.left.size).trim()})${RESET}`
            } else if (entry.status === 'only-right' && entry.right) {
                detail = `${DIM}(${formatSize(entry.right.size).trim()})${RESET}`
            }
        }

        lines.push(
            `  ${color}${sym}${RESET} ${indent}${color}${name}${RESET}${detail ? '  ' + detail : ''}`,
        )
    }

    return lines.join('\n')
}

function formatFlat(entries: CompareEntry[]): string {
    const lines: string[] = []

    for (const entry of entries) {
        const sym = statusSymbol(entry.status)
        const color = statusColor(entry.status)
        const suffix = entry.isDirectory ? '/' : ''
        lines.push(`${color}${sym} ${entry.relativePath}${suffix}${RESET}`)
    }

    return lines.join('\n')
}

interface JsonEntry {
    path: string
    status: DiffStatus
    isDirectory: boolean
    leftSize?: number
    rightSize?: number
}

function formatJson(entries: CompareEntry[]): string {
    const data: JsonEntry[] = entries
        .filter((e) => !e.isDirectory)
        .map((e) => {
            const obj: JsonEntry = {
                path: e.relativePath,
                status: e.status,
                isDirectory: e.isDirectory,
            }
            if (e.left) obj.leftSize = e.left.size
            if (e.right) obj.rightSize = e.right.size
            return obj
        })

    return JSON.stringify(data, null, 2)
}

function formatStat(entries: CompareEntry[]): string {
    const files = entries.filter((e) => !e.isDirectory)
    let modified = 0
    let leftOnly = 0
    let rightOnly = 0

    for (const entry of files) {
        if (entry.status === 'modified') modified++
        else if (entry.status === 'only-left') leftOnly++
        else if (entry.status === 'only-right') rightOnly++
    }

    const total = modified + leftOnly + rightOnly
    if (total === 0) return 'Identical'

    const parts: string[] = []
    if (modified > 0) parts.push(`${modified} modified`)
    if (leftOnly > 0) parts.push(`${leftOnly} only in left`)
    if (rightOnly > 0) parts.push(`${rightOnly} only in right`)

    return parts.join(', ')
}

export async function runDiff(
    leftDir: string,
    rightDir: string,
    ignoreOptions: CliIgnoreOptions,
    options: DiffOptions,
): Promise<void> {
    const { leftScan, rightScan } = await cliScan(
        leftDir,
        rightDir,
        ignoreOptions,
    )

    const entries = collectAllEntries(leftScan, rightScan, '', 0, options.only)

    if (options.stat) {
        console.log(formatStat(entries))
        return
    }

    let output: string
    switch (options.format) {
        case 'tree':
            output = formatTree(entries, leftDir, rightDir)
            break
        case 'flat':
            output = formatFlat(entries)
            break
        case 'json':
            output = formatJson(entries)
            break
    }

    if (output) {
        console.log(output)
    }

    // Print summary at bottom for tree format
    if (options.format === 'tree') {
        console.log('')
        console.log(`${DIM}${formatStat(entries)}${RESET}`)
    }
}
