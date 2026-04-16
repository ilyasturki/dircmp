import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const changelog = JSON.stringify(
    fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8'),
)

const passThrough = process.argv.slice(2)

const args = [
    'build',
    path.join('src', 'index.tsx'),
    '--compile',
    '--define',
    `__CHANGELOG__=${changelog}`,
    ...passThrough,
]

const result = spawnSync('bun', args, { stdio: 'inherit', cwd: ROOT })
process.exit(result.status ?? 1)
