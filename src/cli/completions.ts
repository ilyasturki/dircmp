const SHELLS = ['bash', 'zsh', 'fish'] as const
type Shell = (typeof SHELLS)[number]

export function isValidShell(shell: string): shell is Shell {
    return (SHELLS as readonly string[]).includes(shell)
}

export function getCompletionScript(shell: Shell): string {
    switch (shell) {
        case 'bash':
            return bashCompletions()
        case 'zsh':
            return zshCompletions()
        case 'fish':
            return fishCompletions()
    }
}

export function getInstallHint(shell: Shell): string {
    switch (shell) {
        case 'bash':
            return 'Add to ~/.bashrc:\n  eval "$(dircmp completions bash)"'
        case 'zsh':
            return 'Add to ~/.zshrc:\n  eval "$(dircmp completions zsh)"'
        case 'fish':
            return 'Run once:\n  dircmp completions fish > ~/.config/fish/completions/dircmp.fish'
    }
}

function bashCompletions(): string {
    return `\
_dircmp() {
    local cur prev words cword
    _init_completion || return

    local subcmd=""
    local i
    for ((i = 1; i < cword; i++)); do
        case "\${words[i]}" in
            --ignore|--format|--only) ((i++)) ;;
            diff|check) subcmd="\${words[i]}"; break ;;
        esac
    done

    case "$prev" in
        --format)
            COMPREPLY=($(compgen -W "tree flat json" -- "$cur"))
            return ;;
        --only)
            COMPREPLY=($(compgen -W "modified left-only right-only" -- "$cur"))
            return ;;
        --ignore)
            return ;;
    esac

    if [[ "$cur" == -* ]]; then
        local opts="--help --version --no-ignore --ignore"
        case "$subcmd" in
            diff)  opts="$opts --format --only --stat" ;;
            check) opts="$opts --stat" ;;
        esac
        COMPREPLY=($(compgen -W "$opts" -- "$cur"))
        return
    fi

    if [[ -z "$subcmd" ]]; then
        COMPREPLY=($(compgen -W "diff check completions" -- "$cur"))
        COMPREPLY+=($(compgen -d -- "$cur"))
    else
        COMPREPLY=($(compgen -d -- "$cur"))
    fi
}

complete -o filenames -F _dircmp dircmp`
}

function zshCompletions(): string {
    return `\
#compdef dircmp

_dircmp() {
    local -a subcommands=(
        'diff:Print differences'
        'check:Exit 0 if identical, 1 if different'
        'completions:Print shell completion script'
    )

    local -a global_opts=(
        '(-h --help)'{-h,--help}'[Show help message]'
        '(-v --version)'{-v,--version}'[Show version number]'
        '--no-ignore[Don'"'"'t apply ignore patterns]'
        '*--ignore[Add an ignore pattern]:pattern:'
    )

    _arguments -C \\
        $global_opts \\
        '1:command:->cmd' \\
        '*:: :->args'

    case $state in
        cmd)
            _describe 'command' subcommands
            _directories
            ;;
        args)
            case $words[1] in
                diff)
                    _arguments \\
                        $global_opts \\
                        '--format[Output format]:format:(tree flat json)' \\
                        '--only[Filter results]:filter:(modified left-only right-only)' \\
                        '--stat[Show only a summary line]' \\
                        '1:left directory:_directories' \\
                        '2:right directory:_directories'
                    ;;
                check)
                    _arguments \\
                        $global_opts \\
                        '--stat[Print summary line before exiting]' \\
                        '1:left directory:_directories' \\
                        '2:right directory:_directories'
                    ;;
                completions)
                    _arguments '1:shell:(bash zsh fish)'
                    ;;
                *)
                    _arguments \\
                        '1:left directory:_directories' \\
                        '2:right directory:_directories'
                    ;;
            esac
            ;;
    esac
}

_dircmp "$@"`
}

function fishCompletions(): string {
    return `\
# Fish completions for dircmp

# Disable file completions by default
complete -c dircmp -f

# Helper: detect current subcommand
function __dircmp_has_subcmd
    set -l cmd (commandline -opc)
    for c in $cmd[2..]
        switch $c
            case diff check completions
                return 0
        end
    end
    return 1
end

function __dircmp_subcmd
    set -l cmd (commandline -opc)
    for c in $cmd[2..]
        switch $c
            case diff check completions
                echo $c
                return
        end
    end
end

# Subcommands (only when no subcommand yet)
complete -c dircmp -n 'not __dircmp_has_subcmd' -a diff -d 'Print differences'
complete -c dircmp -n 'not __dircmp_has_subcmd' -a check -d 'Exit 0 if identical, 1 if different'
complete -c dircmp -n 'not __dircmp_has_subcmd' -a completions -d 'Print shell completion script'
complete -c dircmp -n 'not __dircmp_has_subcmd' -F -d 'Directory'

# Global options
complete -c dircmp -s h -l help -d 'Show help message'
complete -c dircmp -s v -l version -d 'Show version number'
complete -c dircmp -l no-ignore -d "Don't apply ignore patterns"
complete -c dircmp -l ignore -x -d 'Add an ignore pattern'

# diff options
complete -c dircmp -n '__dircmp_subcmd = diff' -l format -x -a 'tree flat json' -d 'Output format'
complete -c dircmp -n '__dircmp_subcmd = diff' -l only -x -a 'modified left-only right-only' -d 'Filter results'
complete -c dircmp -n '__dircmp_subcmd = diff' -l stat -d 'Show only a summary line'

# check options
complete -c dircmp -n '__dircmp_subcmd = check' -l stat -d 'Print summary line before exiting'

# completions argument
complete -c dircmp -n '__dircmp_subcmd = completions' -a 'bash zsh fish' -d 'Shell type'

# Directory completions for positional args (when subcommand is diff or check)
complete -c dircmp -n '__dircmp_subcmd = diff' -F -d 'Directory'
complete -c dircmp -n '__dircmp_subcmd = check' -F -d 'Directory'`
}
