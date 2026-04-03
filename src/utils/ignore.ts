import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ignore from 'ignore'

const DEFAULT_IGNORE_PATTERNS = ['.git', 'node_modules', '.DS_Store']

function getDataDir(): string {
    return path.join(os.homedir(), '.local', 'share', 'dircmp')
}

function getGlobalIgnoreFilePath(): string {
    return path.join(getDataDir(), 'ignore')
}

function getPairKey(leftDir: string, rightDir: string): string {
    const sorted = [leftDir, rightDir].sort()
    return crypto
        .createHash('sha256')
        .update(sorted.join('\n'))
        .digest('hex')
        .slice(0, 12)
}

function getPairIgnoreFilePath(leftDir: string, rightDir: string): string {
    return path.join(
        getDataDir(),
        'pairs',
        getPairKey(leftDir, rightDir) + '.ignore',
    )
}

function buildPairHeader(leftDir: string, rightDir: string): string {
    const sorted = [leftDir, rightDir].sort()
    return `# left: ${sorted[0]}\n# right: ${sorted[1]}\n`
}

function parsePatterns(raw: string): string[] {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
}

export function loadGlobalIgnorePatterns(): string[] {
    try {
        const raw = fs.readFileSync(getGlobalIgnoreFilePath(), 'utf-8')
        return parsePatterns(raw)
    } catch {
        return [...DEFAULT_IGNORE_PATTERNS]
    }
}

export function loadPairIgnorePatterns(
    leftDir: string,
    rightDir: string,
): string[] {
    try {
        const raw = fs.readFileSync(
            getPairIgnoreFilePath(leftDir, rightDir),
            'utf-8',
        )
        return parsePatterns(raw)
    } catch {
        return []
    }
}

export function loadAllIgnorePatterns(
    leftDir: string,
    rightDir: string,
): { global: string[]; pair: string[] } {
    return {
        global: loadGlobalIgnorePatterns(),
        pair: loadPairIgnorePatterns(leftDir, rightDir),
    }
}

export async function savePairIgnorePattern(
    pattern: string,
    leftDir: string,
    rightDir: string,
): Promise<void> {
    const pairPath = getPairIgnoreFilePath(leftDir, rightDir)
    await fs.promises.mkdir(path.dirname(pairPath), { recursive: true })
    try {
        await fs.promises.access(pairPath)
    } catch {
        await fs.promises.writeFile(
            pairPath,
            buildPairHeader(leftDir, rightDir),
        )
    }
    await fs.promises.appendFile(pairPath, pattern + '\n')
}

export async function savePairIgnorePatterns(
    patterns: string[],
    leftDir: string,
    rightDir: string,
): Promise<void> {
    const pairPath = getPairIgnoreFilePath(leftDir, rightDir)
    await fs.promises.mkdir(path.dirname(pairPath), { recursive: true })
    await fs.promises.writeFile(
        pairPath,
        buildPairHeader(leftDir, rightDir) + patterns.join('\n') + '\n',
    )
}

export async function saveGlobalIgnorePatterns(
    patterns: string[],
): Promise<void> {
    const globalPath = getGlobalIgnoreFilePath()
    await fs.promises.mkdir(path.dirname(globalPath), { recursive: true })
    await fs.promises.writeFile(globalPath, patterns.join('\n') + '\n')
}

export function compileIgnoreMatcher(
    patterns: string[],
): (relativePath: string) => boolean {
    const ig = ignore().add(patterns)
    return (relativePath) => ig.ignores(relativePath)
}
