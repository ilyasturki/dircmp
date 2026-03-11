import { copyFileSync, cpSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export function copyEntry(
    sourcePath: string,
    destPath: string,
    isDirectory: boolean,
): void {
    mkdirSync(path.dirname(destPath), { recursive: true })
    if (isDirectory) {
        cpSync(sourcePath, destPath, { recursive: true })
    } else {
        copyFileSync(sourcePath, destPath)
    }
}
