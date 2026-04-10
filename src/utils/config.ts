import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface AppConfig {
    dateLocale: string | undefined
    showHints: boolean
    compareDates: boolean
    compareContents: boolean
    diffCommand: string | undefined
    nerdFont: boolean
    dirsFirst: boolean
}

export const defaultConfig: AppConfig = {
    dateLocale: undefined,
    showHints: true,
    compareDates: false,
    compareContents: true,
    diffCommand: undefined,
    nerdFont: true,
    dirsFirst: true,
}

function getConfigPath(): string {
    return path.join(os.homedir(), '.config', 'dircmp', 'config.json')
}

export function loadConfig(): AppConfig {
    try {
        const raw = fs.readFileSync(getConfigPath(), 'utf-8')
        const parsed = JSON.parse(raw)
        return {
            dateLocale:
                typeof parsed.dateLocale === 'string' ?
                    parsed.dateLocale
                :   undefined,
            showHints:
                typeof parsed.showHints === 'boolean' ? parsed.showHints : true,
            compareDates:
                typeof parsed.compareDates === 'boolean' ?
                    parsed.compareDates
                :   true,
            compareContents:
                typeof parsed.compareContents === 'boolean' ?
                    parsed.compareContents
                :   true,
            diffCommand:
                typeof parsed.diffCommand === 'string' ?
                    parsed.diffCommand
                :   undefined,
            nerdFont:
                typeof parsed.nerdFont === 'boolean' ? parsed.nerdFont : true,
            dirsFirst:
                typeof parsed.dirsFirst === 'boolean' ? parsed.dirsFirst : true,
        }
    } catch {
        return { ...defaultConfig }
    }
}

export async function saveConfig(config: AppConfig): Promise<void> {
    const configPath = getConfigPath()
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
    await fs.promises.writeFile(
        configPath,
        JSON.stringify(config, null, 2) + '\n',
    )
}
