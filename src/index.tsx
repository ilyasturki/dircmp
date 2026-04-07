import fs from 'node:fs'
import path from 'node:path'
import meow from 'meow'

import type { CliIgnoreOptions } from '~/cli/types'
import type { ScanResult } from '~/utils/types'
import { compileIgnoreMatcher, loadGlobalIgnorePatterns } from '~/utils/ignore'
import {
    checkRcloneInstalled,
    cleanupMounts,
    mountRemote,
    parseRemoteUri,
    scanRemote,
} from '~/utils/rclone'
import pkg from '../package.json'

const HELP_TEXT = `
  Usage
    $ dircmp <left-dir> <right-dir>              Interactive TUI (default)
    $ dircmp diff <left-dir> <right-dir>         Print differences
    $ dircmp check <left-dir> <right-dir>        Exit 0 if identical, 1 if different

  Directories can be local paths or remote URIs (requires rclone).

  Commands
    (default)       Launch the interactive TUI
    diff            Print a summary of differences to stdout
    check           Silent comparison — useful in scripts/CI
    completions     Print shell completion script (bash, zsh, fish)

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

  Remote Paths (requires rclone — https://rclone.org)
    sftp://user@host/path   SFTP/SSH remote
    s3://bucket/prefix      Amazon S3
    gcs://bucket/prefix     Google Cloud Storage
    remote:path             Named rclone remote

  Examples
    $ dircmp ./project-v1 ./project-v2
    $ dircmp ./local sftp://server/var/www
    $ dircmp s3://bucket-a/prefix s3://bucket-b/prefix
    $ dircmp diff --format flat --only modified ./a ./b
    $ dircmp diff --format json ./a ./b
    $ dircmp check ./expected ./actual
    $ dircmp completions fish > ~/.config/fish/completions/dircmp.fish
`

const cli = meow(HELP_TEXT, {
    importMeta: import.meta,
    version: pkg.version,
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

// Handle completions subcommand early (before positional arg validation)
if (cli.input[0] === 'completions') {
    const { isValidShell, getCompletionScript, getInstallHint } =
        await import('~/cli/completions')
    const shell = cli.input[1]
    if (!shell || !isValidShell(shell)) {
        console.error(
            `Usage: dircmp completions <shell>\n  Shells: bash, zsh, fish`,
        )
        process.exit(1)
    }
    console.log(getCompletionScript(shell))
    if (process.stderr.isTTY) {
        console.error(`\n# ${getInstallHint(shell)}`)
    }
    process.exit(0)
}

// Determine subcommand
const SUBCOMMANDS = ['diff', 'check'] as const
type Subcommand = (typeof SUBCOMMANDS)[number]

let subcommand: Subcommand | null = null
let positionalArgs = cli.input

if (
    positionalArgs.length > 0
    && SUBCOMMANDS.includes(positionalArgs[0] as Subcommand)
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

// Build ignore matcher for pre-scanning remote dirs (pair patterns require
// mount paths which aren't available yet, but they're always empty for remotes
// since the temp mount path changes each session).
const preScanIgnore =
    cli.flags.noIgnore ?
        null
    :   compileIgnoreMatcher([
            ...loadGlobalIgnorePatterns(),
            ...cli.flags.ignore,
        ])

// Resolve paths — mount remote URIs via rclone if needed
const resolvedArgs = await Promise.all(
    [positionalArgs[0]!, positionalArgs[1]!].map(
        async (
            arg,
        ): Promise<{
            dir: string
            label: string | undefined
            remote: string | undefined
            preScan: ScanResult | undefined
        }> => {
            const remote = parseRemoteUri(arg)
            if (!remote) {
                return {
                    dir: path.resolve(arg),
                    label: undefined,
                    remote: undefined,
                    preScan: undefined,
                }
            }
            if (!checkRcloneInstalled()) {
                console.error(
                    'rclone is required for remote paths but was not found.\nInstall it from https://rclone.org/install/',
                )
                process.exit(1)
            }
            try {
                process.stderr.write(`Mounting ${remote.label}...\n`)
                // Start mount and scan concurrently — the scan runs via rclone lsjson
                // while FUSE is still initializing, so they overlap.
                const [mountPoint, preScan] = await Promise.all([
                    mountRemote(remote),
                    scanRemote(remote.remote, preScanIgnore),
                ])
                return {
                    dir: mountPoint,
                    label: remote.label,
                    remote: remote.remote,
                    preScan,
                }
            } catch (err) {
                console.error(
                    `Failed to mount ${arg}: ${err instanceof Error ? err.message : err}`,
                )
                process.exit(1)
            }
        },
    ),
)

const leftDir = resolvedArgs[0]!.dir
const rightDir = resolvedArgs[1]!.dir
const leftLabel = resolvedArgs[0]!.label
const rightLabel = resolvedArgs[1]!.label
const leftRemote = resolvedArgs[0]!.remote
const rightRemote = resolvedArgs[1]!.remote
const leftPreScan = resolvedArgs[0]!.preScan
const rightPreScan = resolvedArgs[1]!.preScan

for (const { dir, label } of resolvedArgs) {
    try {
        const stat = fs.statSync(dir)
        if (!stat.isDirectory()) {
            console.error(`Not a directory: ${label ?? dir}`)
            process.exit(1)
        }
    } catch {
        console.error(`Directory not found: ${label ?? dir}`)
        process.exit(1)
    }
}

const ignoreOptions: CliIgnoreOptions = {
    noIgnore: cli.flags.noIgnore,
    extraIgnorePatterns: cli.flags.ignore,
}

if (subcommand === 'diff') {
    const onlyMap: Record<string, 'modified' | 'only-left' | 'only-right'> = {
        modified: 'modified',
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
    cleanupMounts()
} else if (subcommand === 'check') {
    const { runCheck } = await import('~/cli/check')
    await runCheck(leftDir, rightDir, ignoreOptions, {
        stat: cli.flags.stat,
    })
    cleanupMounts()
} else {
    // Default: interactive TUI
    const { render } = await import('ink')
    const { App } = await import('~/app')
    const { loadConfig } = await import('~/utils/config')

    const config = loadConfig()

    const { terminal } = await import('os-theme')
    const terminalTheme = (await terminal.current()) ?? 'dark'

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
            leftLabel={leftLabel}
            rightLabel={rightLabel}
            leftRemote={leftRemote}
            rightRemote={rightRemote}
            leftPreScan={leftPreScan}
            rightPreScan={rightPreScan}
            initialConfig={config}
            ignoreOptions={ignoreOptions}
            terminalTheme={terminalTheme}
        />,
    )

    try {
        await waitUntilExit()
    } finally {
        exitAlternateScreen()
        cleanupMounts()
    }
}
