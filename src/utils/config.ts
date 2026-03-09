import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AppConfig {
  dateLocale: string | undefined;
}

export const defaultConfig: AppConfig = { dateLocale: undefined };

function getConfigPath(): string {
  return path.join(os.homedir(), '.config', 'ddiff', 'config.json');
}

export function loadConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      dateLocale: typeof parsed.dateLocale === 'string' ? parsed.dateLocale : undefined,
    };
  } catch {
    return { ...defaultConfig };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const configPath = getConfigPath();
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}
