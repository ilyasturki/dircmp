import fs from 'node:fs'
import path from 'node:path'
import { render } from 'ink'
import meow from 'meow'

import { App } from '~/app'
import { loadConfig } from '~/utils/config'

const cli = meow(
    `
  Usage
    $ dircmp <left-dir> <right-dir>

  Options
    -h, --help     Show this help message
    -v, --version  Show version number
`,
    {
        importMeta: import.meta,
        flags: {
            version: {
                type: 'boolean',
                shortFlag: 'v',
            },
        },
    },
)

if (cli.input.length === 0) {
    cli.showHelp(0)
}

if (cli.input.length !== 2) {
    console.error('Usage: dircmp <left-dir> <right-dir>')
    console.error("Run 'dircmp --help' for more information.")
    process.exit(1)
}

const leftDir = path.resolve(cli.input[0]!)
const rightDir = path.resolve(cli.input[1]!)

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
