import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface AppConfig {
    dateLocale: string | undefined
    showHints: boolean
    compareDates: boolean
    diffCommand: string | undefined
}

export const defaultConfig: AppConfig = {
    dateLocale: undefined,
    showHints: true,
    compareDates: false,
    diffCommand: undefined,
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
            diffCommand:
                typeof parsed.diffCommand === 'string' ?
                    parsed.diffCommand
                :   undefined,
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
