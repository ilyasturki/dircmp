import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ignore from 'ignore'

const DEFAULT_IGNORE_PATTERNS = ['.git', 'node_modules', '.DS_Store']

function getIgnoreFilePath(): string {
    return path.join(os.homedir(), '.local', 'share', 'dircmp', 'ignore')
}

export function loadIgnorePatterns(): string[] {
    try {
        const raw = fs.readFileSync(getIgnoreFilePath(), 'utf-8')
        return raw
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '' && !line.startsWith('#'))
    } catch {
        return [...DEFAULT_IGNORE_PATTERNS]
    }
}

export async function saveIgnorePattern(pattern: string): Promise<void> {
    const ignorePath = getIgnoreFilePath()
    await fs.promises.mkdir(path.dirname(ignorePath), { recursive: true })
    try {
        await fs.promises.access(ignorePath)
    } catch {
        await fs.promises.writeFile(
            ignorePath,
            DEFAULT_IGNORE_PATTERNS.join('\n') + '\n',
        )
    }
    await fs.promises.appendFile(ignorePath, pattern + '\n')
}

export async function saveIgnorePatterns(patterns: string[]): Promise<void> {
    const ignorePath = getIgnoreFilePath()
    await fs.promises.mkdir(path.dirname(ignorePath), { recursive: true })
    await fs.promises.writeFile(ignorePath, patterns.join('\n') + '\n')
}

export function compileIgnoreMatcher(
    patterns: string[],
): (relativePath: string) => boolean {
    const ig = ignore().add(patterns)
    return (relativePath) => ig.ignores(relativePath)
}
