import {
    copyFileSync,
    cpSync,
    mkdirSync,
    readlinkSync,
    symlinkSync,
} from 'node:fs'
import path from 'node:path'

import type { EntryType } from '~/utils/types'

export function copyEntry(
    sourcePath: string,
    destPath: string,
    type: EntryType,
): void {
    mkdirSync(path.dirname(destPath), { recursive: true })
    if (type === 'symlink') {
        symlinkSync(readlinkSync(sourcePath), destPath)
    } else if (type === 'directory') {
        cpSync(sourcePath, destPath, {
            recursive: true,
            dereference: false,
            verbatimSymlinks: true,
        })
    } else {
        copyFileSync(sourcePath, destPath)
    }
}
