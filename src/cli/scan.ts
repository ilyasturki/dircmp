import type { CliIgnoreOptions } from '~/cli/types'
import type { ScanResult } from '~/utils/types'
import { compileIgnoreMatcher, loadAllIgnorePatterns } from '~/utils/ignore'
import { scanDirectory } from '~/utils/scanner'

export async function cliScan(
    leftDir: string,
    rightDir: string,
    ignoreOptions: CliIgnoreOptions,
    computeHash: boolean = true,
): Promise<{ leftScan: ScanResult; rightScan: ScanResult }> {
    let shouldIgnore: ((relativePath: string) => boolean) | null = null

    if (!ignoreOptions.noIgnore) {
        const { global, pair } = loadAllIgnorePatterns(leftDir, rightDir)
        const allPatterns = [
            ...global,
            ...pair,
            ...ignoreOptions.extraIgnorePatterns,
        ]
        shouldIgnore = compileIgnoreMatcher(allPatterns)
    }

    const [leftScan, rightScan] = await Promise.all([
        scanDirectory(leftDir, shouldIgnore, computeHash),
        scanDirectory(rightDir, shouldIgnore, computeHash),
    ])

    return { leftScan, rightScan }
}
