import fs from 'node:fs'
import path from 'node:path'
import meow from 'meow'

import type { CliIgnoreOptions } from '~/cli/types'

const HELP_TEXT = `
  Usage
    $ dircmp <left-dir> <right-dir>              Interactive TUI (default)
    $ dircmp diff <left-dir> <right-dir>         Print differences
    $ dircmp check <left-dir> <right-dir>        Exit 0 if identical, 1 if different

  Commands
    (default)   Launch the interactive TUI
    diff        Print a summary of differences to stdout
    check       Silent comparison — useful in scripts/CI

  Global Options
    -h, --help              Show this help message
    -v, --version           Show version number
    --no-ignore             Don't apply ignore patterns
    --ignore <pattern>      Add an ignore pattern (repeatable)

  Options for diff
    --format <fmt>          Output format: tree (default), flat, json
    --only <filter>         Filter: modified, left-only, right-only
    --stat                  Show only a summary line

  Options for check
    --stat                  Print summary line before exiting

  Examples
    $ dircmp ./project-v1 ./project-v2
    $ dircmp diff --format flat --only modified ./a ./b
    $ dircmp diff --format json ./a ./b
    $ dircmp check ./expected ./actual
`

const cli = meow(HELP_TEXT, {
    importMeta: import.meta,
    flags: {
        version: {
            type: 'boolean',
            shortFlag: 'v',
        },
        noIgnore: {
            type: 'boolean',
            default: false,
        },
        ignore: {
            type: 'string',
            isMultiple: true,
            default: [],
        },
        format: {
            type: 'string',
            default: 'tree',
        },
        only: {
            type: 'string',
        },
        stat: {
            type: 'boolean',
            default: false,
        },
    },
})

// Determine subcommand
const SUBCOMMANDS = ['diff', 'check'] as const
type Subcommand = (typeof SUBCOMMANDS)[number]

let subcommand: Subcommand | null = null
let positionalArgs = cli.input

if (
    positionalArgs.length > 0 &&
    SUBCOMMANDS.includes(positionalArgs[0] as Subcommand)
) {
    subcommand = positionalArgs[0] as Subcommand
    positionalArgs = positionalArgs.slice(1)
}

if (positionalArgs.length === 0) {
    cli.showHelp(0)
}

if (positionalArgs.length !== 2) {
    console.error('Usage: dircmp [diff|check] <left-dir> <right-dir>')
    console.error("Run 'dircmp --help' for more information.")
    process.exit(1)
}

const leftDir = path.resolve(positionalArgs[0]!)
const rightDir = path.resolve(positionalArgs[1]!)

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

const ignoreOptions: CliIgnoreOptions = {
    noIgnore: cli.flags.noIgnore,
    extraIgnorePatterns: cli.flags.ignore,
}

if (subcommand === 'diff') {
    const onlyMap: Record<string, 'modified' | 'only-left' | 'only-right'> = {
        'modified': 'modified',
        'left-only': 'only-left',
        'right-only': 'only-right',
        'only-left': 'only-left',
        'only-right': 'only-right',
    }
    const onlyRaw = cli.flags.only
    const onlyFilter = onlyRaw ? onlyMap[onlyRaw] : undefined
    if (onlyRaw && !onlyFilter) {
        console.error(
            `Invalid --only value: "${onlyRaw}". Must be one of: modified, left-only, right-only`,
        )
        process.exit(1)
    }

    const { runDiff } = await import('~/cli/diff')
    await runDiff(leftDir, rightDir, ignoreOptions, {
        format: cli.flags.format as 'tree' | 'flat' | 'json',
        only: onlyFilter,
        stat: cli.flags.stat,
    })
} else if (subcommand === 'check') {
    const { runCheck } = await import('~/cli/check')
    await runCheck(leftDir, rightDir, ignoreOptions, {
        stat: cli.flags.stat,
    })
} else {
    // Default: interactive TUI
    const { render } = await import('ink')
    const { App } = await import('~/app')
    const { loadConfig } = await import('~/utils/config')

    const config = loadConfig()

    const ENTER_ALT_SCREEN = '\x1b[?1049h'
    const EXIT_ALT_SCREEN = '\x1b[?1049l'

    let inAlternateScreen = false

    const exitAlternateScreen = () => {
        if (inAlternateScreen) {
            inAlternateScreen = false
            process.stdout.write(EXIT_ALT_SCREEN)
        }
    }

    process.stdout.write(ENTER_ALT_SCREEN)
    inAlternateScreen = true
    process.on('exit', exitAlternateScreen)

    const { waitUntilExit } = render(
        <App
            leftDir={leftDir}
            rightDir={rightDir}
            initialConfig={config}
            ignoreOptions={ignoreOptions}
        />,
    )

    try {
        await waitUntilExit()
    } finally {
        exitAlternateScreen()
    }
}
