import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import picomatch from 'picomatch'

const DEFAULT_PATTERNS = ['.git', 'node_modules', '.DS_Store']

function getIgnorePath(): string {
    return path.join(os.homedir(), '.local', 'share', 'dircmp', 'ignore')
}

export function loadIgnorePatterns(): string[] {
    try {
        const raw = fs.readFileSync(getIgnorePath(), 'utf-8')
        return raw
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '' && !line.startsWith('#'))
    } catch {
        return [...DEFAULT_PATTERNS]
    }
}

export async function saveIgnorePattern(pattern: string): Promise<void> {
    const ignorePath = getIgnorePath()
    await fs.promises.mkdir(path.dirname(ignorePath), { recursive: true })
    try {
        await fs.promises.access(ignorePath)
    } catch {
        await fs.promises.writeFile(
            ignorePath,
            DEFAULT_PATTERNS.join('\n') + '\n',
        )
    }
    await fs.promises.appendFile(ignorePath, pattern + '\n')
}

export function compileIgnoreMatcher(
    patterns: string[],
): (relativePath: string) => boolean {
    const normalized = patterns.map((p) =>
        p.includes('/') || p.includes('*') ? p : `**/${p}`,
    )
    const isMatch = picomatch(normalized, { dot: true })
    return isMatch
}
