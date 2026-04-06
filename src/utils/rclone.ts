import type { ChildProcess } from 'node:child_process'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

interface RemotePath {
    /** rclone remote spec, e.g. ":sftp,host=server:/path" or "myremote:bucket/prefix" */
    remote: string
    /** Display label for the panel title, e.g. "sftp://server/path" */
    label: string
}

interface MountHandle {
    /** Local mount point directory */
    mountPoint: string
    /** rclone child process */
    child: ChildProcess
    /** Display label for the panel title */
    label: string
}

const activeMounts: MountHandle[] = []
let cleanupRegistered = false

/**
 * Parse a CLI argument into an rclone remote spec, or return null if it's a local path.
 *
 * Supported formats:
 *   sftp://user@host/path      → :sftp,host=host,user=user:/path
 *   s3://bucket/prefix         → :s3:bucket/prefix
 *   gcs://bucket/prefix        → :gcs:bucket/prefix
 *   myremote:/path             → myremote:/path  (named rclone remote)
 */
export function parseRemoteUri(arg: string): RemotePath | null {
    // sftp:// with optional user@
    const sftpMatch = arg.match(
        /^sftp:\/\/(?:([^@]+)@)?([^:/]+)(?::(\d+))?(\/.*)?$/,
    )
    if (sftpMatch) {
        const [, user, host, port, remotePath] = sftpMatch
        const parts = [`host=${host}`]
        if (user) parts.push(`user=${user}`)
        if (port) parts.push(`port=${port}`)
        return {
            remote: `:sftp,${parts.join(',')}:${remotePath ?? '/'}`,
            label: arg,
        }
    }

    // s3://bucket/prefix
    const s3Match = arg.match(/^s3:\/\/(.+)$/)
    if (s3Match) {
        return { remote: `:s3:${s3Match[1]}`, label: arg }
    }

    // gcs://bucket/prefix
    const gcsMatch = arg.match(/^gcs:\/\/(.+)$/)
    if (gcsMatch) {
        return { remote: `:gcs:${gcsMatch[1]}`, label: arg }
    }

    // Named rclone remote — "remotename:path" but not Windows drive letters like "C:\..."
    const namedMatch = arg.match(/^([A-Za-z][A-Za-z0-9_-]*):(.+)$/)
    if (namedMatch && !arg.match(/^[A-Za-z]:\\/)) {
        return { remote: arg, label: arg }
    }

    return null
}

/** Check if rclone is installed and accessible */
export function checkRcloneInstalled(): boolean {
    const result = spawnSync('rclone', ['version'], {
        stdio: 'ignore',
        timeout: 5000,
    })
    return result.status === 0
}

/**
 * Mount a remote path using rclone and wait for it to become ready.
 * Returns the local mount point path.
 */
export async function mountRemote(remotePath: RemotePath): Promise<string> {
    const mountPoint = fs.mkdtempSync(path.join(os.tmpdir(), 'dircmp-rclone-'))

    const child = spawn(
        'rclone',
        ['mount', remotePath.remote, mountPoint, '--vfs-cache-mode', 'full'],
        { stdio: 'ignore', detached: false },
    )

    const handle: MountHandle = { mountPoint, child, label: remotePath.label }
    activeMounts.push(handle)
    registerCleanup()

    // Wait for mount to become ready by polling for directory content
    await waitForMount(mountPoint, child)

    return mountPoint
}

async function waitForMount(
    mountPoint: string,
    child: ChildProcess,
): Promise<void> {
    const timeoutMs = 30_000
    const pollMs = 100
    const start = Date.now()

    return new Promise((resolve, reject) => {
        child.on('error', (err) => {
            reject(new Error(`rclone failed to start: ${err.message}`))
        })

        child.on('exit', (code) => {
            if (code !== null && code !== 0) {
                reject(
                    new Error(
                        `rclone exited with code ${code}. Check that the remote path is valid and credentials are configured.`,
                    ),
                )
            }
        })

        const poll = () => {
            if (Date.now() - start > timeoutMs) {
                reject(
                    new Error(
                        `Timed out waiting for rclone mount at ${mountPoint}`,
                    ),
                )
                return
            }

            try {
                // Once we can stat the mount point and it's still a directory,
                // the FUSE mount is ready
                fs.readdirSync(mountPoint)
                resolve()
            } catch {
                setTimeout(poll, pollMs)
            }
        }

        // Give rclone a moment to initialize before first poll
        setTimeout(poll, pollMs)
    })
}

function registerCleanup() {
    if (cleanupRegistered) return
    cleanupRegistered = true

    process.on('exit', cleanupMounts)
    process.on('SIGINT', () => {
        cleanupMounts()
        process.exit(130)
    })
    process.on('SIGTERM', () => {
        cleanupMounts()
        process.exit(143)
    })
}

export function cleanupMounts() {
    for (const mount of activeMounts) {
        try {
            mount.child.kill('SIGTERM')
        } catch {
            // process may already be dead
        }
        try {
            // Give rclone a moment to unmount, then force-remove the dir
            spawnSync('fusermount', ['-u', mount.mountPoint], {
                stdio: 'ignore',
                timeout: 5000,
            })
        } catch {
            // fusermount may not exist (macOS uses umount)
            try {
                spawnSync('umount', [mount.mountPoint], {
                    stdio: 'ignore',
                    timeout: 5000,
                })
            } catch {
                // best effort
            }
        }
        try {
            fs.rmdirSync(mount.mountPoint)
        } catch {
            // mount point may still be busy
        }
    }
    activeMounts.length = 0
}
