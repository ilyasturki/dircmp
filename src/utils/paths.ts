import os from 'node:os'
import path from 'node:path'

export function getConfigDir(): string {
    const xdg = process.env.XDG_CONFIG_HOME
    const base = xdg && xdg !== '' ? xdg : path.join(os.homedir(), '.config')
    return path.join(base, 'dircmp')
}

export function getDataDir(): string {
    const xdg = process.env.XDG_DATA_HOME
    const base =
        xdg && xdg !== '' ? xdg : path.join(os.homedir(), '.local', 'share')
    return path.join(base, 'dircmp')
}
