import type { CliIgnoreOptions } from '~/cli/types'
import type { ScanResult } from '~/utils/types'
import { compareAtPath } from '~/utils/compare'
import { cliScan } from './scan'

interface CheckOptions {
    stat: boolean
}

function hasDifferences(
    leftScan: ScanResult,
    rightScan: ScanResult,
    dirPath: string,
    counts: { modified: number; leftOnly: number; rightOnly: number },
): boolean {
    const entries = compareAtPath(leftScan, rightScan, dirPath)
    let found = false

    for (const entry of entries) {
        if (entry.status === 'modified' && !entry.isDirectory) {
            counts.modified++
            found = true
        } else if (entry.status === 'only-left') {
            counts.leftOnly++
            found = true
        } else if (entry.status === 'only-right') {
            counts.rightOnly++
            found = true
        }

        if (
            entry.isDirectory
            && entry.status !== 'only-left'
            && entry.status !== 'only-right'
        ) {
            if (
                hasDifferences(leftScan, rightScan, entry.relativePath, counts)
            ) {
                found = true
            }
        }
    }

    return found
}

export async function runCheck(
    leftDir: string,
    rightDir: string,
    ignoreOptions: CliIgnoreOptions,
    options: CheckOptions,
): Promise<void> {
    const { leftScan, rightScan } = await cliScan(
        leftDir,
        rightDir,
        ignoreOptions,
    )

    const counts = { modified: 0, leftOnly: 0, rightOnly: 0 }
    const different = hasDifferences(leftScan, rightScan, '', counts)

    if (options.stat) {
        if (different) {
            const parts: string[] = []
            if (counts.modified > 0) parts.push(`${counts.modified} modified`)
            if (counts.leftOnly > 0)
                parts.push(`${counts.leftOnly} only in left`)
            if (counts.rightOnly > 0)
                parts.push(`${counts.rightOnly} only in right`)
            console.log(parts.join(', '))
        } else {
            console.log('Identical')
        }
    }

    process.exit(different ? 1 : 0)
}
