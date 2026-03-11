import fs from 'node:fs'
import path from 'node:path'
import { render } from 'ink'

import { App } from '~/app'
import { loadConfig } from '~/utils/config'

const args = process.argv.slice(2)

if (args.length !== 2) {
    console.error('Usage: dirdiff <left-dir> <right-dir>')
    process.exit(1)
}

const leftDir = path.resolve(args[0]!)
const rightDir = path.resolve(args[1]!)

for (const dir of [leftDir, rightDir]) {
    try {
        const stat = fs.statSync(dir)
        if (!stat.isDirectory()) {
            console.error(`Not a directory: ${dir}`)
            process.exit(1)
        }
    } catch {
        console.error(`Directory not found: ${dir}`)
        process.exit(1)
    }
}

const config = loadConfig()
const { waitUntilExit } = render(
    <App
        leftDir={leftDir}
        rightDir={rightDir}
        initialConfig={config}
    />,
)
await waitUntilExit()
