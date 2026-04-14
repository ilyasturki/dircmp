import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function getTrashRoot(): string {
    const cacheHome =
        process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
    return path.join(cacheHome, 'dircmp', 'trash')
}

let sessionDir: string | null = null
let entryCounter = 0
let cleanupRegistered = false

export function initTrashSession(): void {
    const root = getTrashRoot()
    if (sessionDir && path.dirname(sessionDir) === root) return
    fs.mkdirSync(root, { recursive: true })
    purgeOrphans(root)
    sessionDir = path.join(root, `${process.pid}-${Date.now()}`)
    fs.mkdirSync(sessionDir, { recursive: true })
    entryCounter = 0
    if (!cleanupRegistered) {
        cleanupRegistered = true
        process.on('exit', () => {
            if (!sessionDir) return
            try {
                fs.rmSync(sessionDir, { recursive: true, force: true })
            } catch {
                // best effort
            }
        })
    }
}

function purgeOrphans(root: string): void {
    let names: string[]
    try {
        names = fs.readdirSync(root)
    } catch {
        return
    }
    for (const name of names) {
        const match = /^(\d+)-\d+$/.exec(name)
        if (!match) continue
        const pid = Number(match[1])
        if (pid === process.pid) continue
        try {
            // Signal 0 throws if the process does not exist
            process.kill(pid, 0)
        } catch {
            try {
                fs.rmSync(path.join(root, name), {
                    recursive: true,
                    force: true,
                })
            } catch {
                // best effort
            }
        }
    }
}

export function moveToTrash(absPath: string): string {
    if (!sessionDir) throw new Error('Trash session not initialized')
    const entryDir = path.join(sessionDir, String(++entryCounter))
    fs.mkdirSync(entryDir, { recursive: true })
    const trashPath = path.join(entryDir, path.basename(absPath))
    try {
        fs.renameSync(absPath, trashPath)
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
            fs.cpSync(absPath, trashPath, { recursive: true })
            fs.rmSync(absPath, { recursive: true, force: true })
        } else {
            throw err
        }
    }
    return trashPath
}

export function restoreFromTrash(trashPath: string, destPath: string): void {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    try {
        fs.renameSync(trashPath, destPath)
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
            fs.cpSync(trashPath, destPath, { recursive: true })
            fs.rmSync(trashPath, { recursive: true, force: true })
        } else {
            throw err
        }
    }
}
