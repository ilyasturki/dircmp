import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

// Injected at compile time via `bun build --define __CHANGELOG__=...`.
// Undefined in tsx/dev and npm-bundle runs; those fall back to fs.readFileSync below.
declare const __CHANGELOG__: string

let changelogText = ''
if (typeof __CHANGELOG__ !== 'undefined') {
    changelogText = __CHANGELOG__
} else {
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url))
        changelogText = fs.readFileSync(
            path.join(__dirname, '..', 'CHANGELOG.md'),
            'utf-8',
        )
    } catch {}
}

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
    --follow-symlinks       Follow symbolic links as their targets
                            (default: compare links by their target path)

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

  Run 'dircmp <command> --help' for command-specific options.
`

const DIFF_HELP_TEXT = `
  Usage
    $ dircmp diff <left-dir> <right-dir>

  Print a summary of differences between two directories to stdout.
  Directories can be local paths or remote URIs (requires rclone).

  Options
    --format <fmt>          Output format: tree (default), flat, json
    --only <filter>         Filter: modified, left-only, right-only
    --stat                  Show only a summary line
    --no-ignore             Don't apply ignore patterns
    --ignore <pattern>      Add an ignore pattern (repeatable)
    --follow-symlinks       Follow symbolic links as their targets
    -h, --help              Show this help message

  Examples
    $ dircmp diff ./a ./b
    $ dircmp diff --format flat --only modified ./a ./b
    $ dircmp diff --format json ./a ./b
    $ dircmp diff --stat ./a ./b
`

const CHECK_HELP_TEXT = `
  Usage
    $ dircmp check <left-dir> <right-dir>

  Silent comparison — exits 0 if identical, 1 if different.
  Useful in scripts and CI pipelines.

  Options
    --stat                  Print summary line before exiting
    --no-ignore             Don't apply ignore patterns
    --ignore <pattern>      Add an ignore pattern (repeatable)
    --follow-symlinks       Follow symbolic links as their targets
    -h, --help              Show this help message

  Examples
    $ dircmp check ./expected ./actual
    $ dircmp check --stat ./expected ./actual
`

const cli = meow(HELP_TEXT, {
    importMeta: import.meta,
    version: pkg.version,
    autoHelp: false,
    flags: {
        help: {
            type: 'boolean',
            shortFlag: 'h',
        },
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
        followSymlinks: {
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

if (cli.flags.help) {
    if (subcommand === 'diff') {
        console.log(DIFF_HELP_TEXT)
    } else if (subcommand === 'check') {
        console.log(CHECK_HELP_TEXT)
    } else {
        console.log(HELP_TEXT)
    }
    process.exit(0)
}

if (positionalArgs.length === 0) {
    console.log(HELP_TEXT)
    process.exit(0)
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

// Detect whether both args are files (for direct file diff)
let fileMode = false
for (const { dir, label } of resolvedArgs) {
    try {
        const stat = fs.statSync(dir)
        if (!stat.isDirectory()) {
            if (!stat.isFile()) {
                console.error(`Not a file or directory: ${label ?? dir}`)
                process.exit(1)
            }
        }
    } catch {
        console.error(`Path not found: ${label ?? dir}`)
        process.exit(1)
    }
}

const leftIsFile = fs.statSync(leftDir).isFile()
const rightIsFile = fs.statSync(rightDir).isFile()
if (leftIsFile !== rightIsFile) {
    console.error('Cannot compare a file with a directory')
    process.exit(1)
}
fileMode = leftIsFile

const ignoreOptions: CliIgnoreOptions = {
    noIgnore: cli.flags.noIgnore,
    extraIgnorePatterns: cli.flags.ignore,
}

if (fileMode && subcommand === 'diff') {
    const { runFileDiff } = await import('~/cli/file-diff')
    await runFileDiff(leftDir, rightDir)
    cleanupMounts()
} else if (fileMode && subcommand === 'check') {
    const { runFileCheck } = await import('~/cli/file-check')
    await runFileCheck(leftDir, rightDir, { stat: cli.flags.stat })
    cleanupMounts()
} else if (subcommand === 'diff') {
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

    const { runDiff } = await import('~/cli/directory-diff')
    await runDiff(leftDir, rightDir, ignoreOptions, {
        format: cli.flags.format as 'tree' | 'flat' | 'json',
        only: onlyFilter,
        stat: cli.flags.stat,
        followSymlinks: cli.flags.followSymlinks,
    })
    cleanupMounts()
} else if (subcommand === 'check') {
    const { runCheck } = await import('~/cli/directory-check')
    await runCheck(leftDir, rightDir, ignoreOptions, {
        stat: cli.flags.stat,
        followSymlinks: cli.flags.followSymlinks,
    })
    cleanupMounts()
} else {
    // Default: interactive TUI
    const { render } = await import('ink')

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

    let instance: { waitUntilExit: () => Promise<unknown> }

    const { loadConfig } = await import('~/utils/config')
    const config = loadConfig()

    if (fileMode) {
        const { FileDiffApp } = await import('~/file-diff-app')
        instance = render(
            <FileDiffApp
                leftFile={leftDir}
                rightFile={rightDir}
                initialConfig={config}
                changelog={changelogText}
            />,
        )
    } else {
        const { App } = await import('~/app')

        instance = render(
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
                changelog={changelogText}
                followSymlinks={cli.flags.followSymlinks}
            />,
        )
    }

    try {
        await instance.waitUntilExit()
    } finally {
        exitAlternateScreen()
        cleanupMounts()
    }
}
