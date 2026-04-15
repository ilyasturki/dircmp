import fsp from 'node:fs/promises'
import path from 'node:path'
import { diffLines } from 'diff'

import type { CliIgnoreOptions } from '~/cli/types'
import type { CompareEntry, DiffStatus, ScanResult } from '~/utils/types'
import { compareAtPath } from '~/utils/compare'
import { formatSize } from '~/utils/format-size'
import { ansiBold, ansiDim, ansiFor, ansiReset } from '~/utils/theme'
import { cliScan } from './scan'

interface DiffOptions {
    format: 'tree' | 'flat' | 'json'
    only?: 'modified' | 'only-left' | 'only-right'
    stat: boolean
    followSymlinks: boolean
}

type DiffFilter = DiffOptions['only']

function collectAllEntries(
    leftScan: ScanResult,
    rightScan: ScanResult,
    dirPath: string,
    depth: number,
    filter: DiffFilter,
): CompareEntry[] {
    const entries = compareAtPath(leftScan, rightScan, dirPath, dirPath, {
        compareDates: false,
        compareContents: true,
    })
    const result: CompareEntry[] = []

    for (const entry of entries) {
        if (entry.status === 'identical') continue
        if (filter && entry.status !== filter) continue

        result.push({ ...entry, depth })

        if (entry.type === 'directory') {
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
            return ansiFor('entryModified')
        case 'only-left':
            return ansiFor('entryOnlyLeft')
        case 'only-right':
            return ansiFor('entryOnlyRight')
        case 'identical':
            return ''
    }
}

interface LineDiff {
    added: number
    removed: number
}

async function computeLineDiffs(
    entries: CompareEntry[],
    leftDir: string,
    rightDir: string,
): Promise<Map<string, LineDiff>> {
    const result = new Map<string, LineDiff>()
    const modified = entries.filter(
        (e) => e.type === 'file' && e.status === 'modified',
    )

    await Promise.all(
        modified.map(async (entry) => {
            try {
                const [leftContent, rightContent] = await Promise.all([
                    fsp.readFile(
                        path.join(leftDir, entry.relativePath),
                        'utf-8',
                    ),
                    fsp.readFile(
                        path.join(rightDir, entry.relativePath),
                        'utf-8',
                    ),
                ])
                const changes = diffLines(leftContent, rightContent)
                let added = 0
                let removed = 0
                for (const change of changes) {
                    const lineCount = change.count ?? 0
                    if (change.added) added += lineCount
                    else if (change.removed) removed += lineCount
                }
                result.set(entry.relativePath, { added, removed })
            } catch {
                // Binary file or read error — skip line diff
            }
        }),
    )

    return result
}

const RESET = ansiReset
const DIM = ansiDim
const BOLD = ansiBold
const GREEN = ansiFor('diffAddedCount')
const RED = ansiFor('diffRemovedCount')

function formatLineDiff(ld: LineDiff | undefined): string {
    if (!ld) return ''
    const parts: string[] = []
    if (ld.added > 0) parts.push(`${GREEN}+${ld.added}${RESET}`)
    if (ld.removed > 0) parts.push(`${RED}-${ld.removed}${RESET}`)
    return parts.length > 0 ? parts.join(' ') : ''
}

function formatTree(
    entries: CompareEntry[],
    leftDir: string,
    rightDir: string,
    lineDiffs: Map<string, LineDiff>,
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
        const suffix =
            entry.type === 'directory' ? '/'
            : entry.type === 'symlink' ? '@'
            : ''
        const name = entry.name + suffix

        const detailParts: string[] = []
        if (entry.type !== 'directory') {
            if (entry.status === 'modified' && entry.left && entry.right) {
                detailParts.push(
                    `${DIM}${formatSize(entry.left.size).trim()} → ${formatSize(entry.right.size).trim()}${RESET}`,
                )
                const ld = formatLineDiff(lineDiffs.get(entry.relativePath))
                if (ld) detailParts.push(ld)
            } else if (entry.status === 'only-left' && entry.left) {
                detailParts.push(
                    `${DIM}${formatSize(entry.left.size).trim()}${RESET}`,
                )
            } else if (entry.status === 'only-right' && entry.right) {
                detailParts.push(
                    `${DIM}${formatSize(entry.right.size).trim()}${RESET}`,
                )
            }
        }

        const detail =
            detailParts.length > 0 ?
                `  ${DIM}(${RESET}${detailParts.join(`${DIM}, ${RESET}`)}${DIM})${RESET}`
            :   ''
        lines.push(
            `  ${color}${sym}${RESET} ${indent}${color}${name}${RESET}${detail}`,
        )
    }

    return lines.join('\n')
}

function formatFlat(
    entries: CompareEntry[],
    lineDiffs: Map<string, LineDiff>,
): string {
    const lines: string[] = []

    for (const entry of entries) {
        const sym = statusSymbol(entry.status)
        const color = statusColor(entry.status)
        const suffix =
            entry.type === 'directory' ? '/'
            : entry.type === 'symlink' ? '@'
            : ''
        let line = `${color}${sym} ${entry.relativePath}${suffix}${RESET}`
        const ld = formatLineDiff(lineDiffs.get(entry.relativePath))
        if (ld) line += `  ${ld}`
        lines.push(line)
    }

    return lines.join('\n')
}

interface JsonEntry {
    path: string
    status: DiffStatus
    type: 'file' | 'directory' | 'symlink'
    leftSize?: number
    rightSize?: number
    linesAdded?: number
    linesRemoved?: number
    leftLinkTarget?: string
    rightLinkTarget?: string
}

function formatJson(
    entries: CompareEntry[],
    lineDiffs: Map<string, LineDiff>,
): string {
    const data: JsonEntry[] = entries
        .filter((e) => e.type !== 'directory')
        .map((e) => {
            const obj: JsonEntry = {
                path: e.relativePath,
                status: e.status,
                type: e.type,
            }
            if (e.left) obj.leftSize = e.left.size
            if (e.right) obj.rightSize = e.right.size
            if (e.left?.linkTarget) obj.leftLinkTarget = e.left.linkTarget
            if (e.right?.linkTarget) obj.rightLinkTarget = e.right.linkTarget
            const ld = lineDiffs.get(e.relativePath)
            if (ld) {
                obj.linesAdded = ld.added
                obj.linesRemoved = ld.removed
            }
            return obj
        })

    return JSON.stringify(data, null, 2)
}

function formatStat(entries: CompareEntry[]): string {
    const files = entries.filter((e) => e.type !== 'directory')
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
        true,
        options.followSymlinks,
    )

    const entries = collectAllEntries(leftScan, rightScan, '', 0, options.only)

    if (options.stat) {
        console.log(formatStat(entries))
        return
    }

    const lineDiffs = await computeLineDiffs(entries, leftDir, rightDir)

    let output: string
    switch (options.format) {
        case 'tree':
            output = formatTree(entries, leftDir, rightDir, lineDiffs)
            break
        case 'flat':
            output = formatFlat(entries, lineDiffs)
            break
        case 'json':
            output = formatJson(entries, lineDiffs)
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
