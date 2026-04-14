const FILENAME_ICONS: Record<string, string> = {
    '.gitignore': '\ue725',
    '.gitmodules': '\ue725',
    '.gitattributes': '\ue725',
    dockerfile: '\ue7b0',
    'docker-compose.yml': '\ue7b0',
    'docker-compose.yaml': '\ue7b0',
    'package.json': '\ue718',
    'package-lock.json': '\ue718',
    license: '\uf0219',
    'license.md': '\uf0219',
    makefile: '\ue779',
    'tsconfig.json': '\ue628',
    'cargo.toml': '\ue7a8',
    'cargo.lock': '\ue7a8',
    'go.mod': '\ue626',
    'go.sum': '\ue626',
    'flake.nix': '\uf313',
    'flake.lock': '\uf313',
    'readme.md': '\uf48a',
    'readme.txt': '\uf48a',
    '.env': '\ue615',
    '.env.local': '\ue615',
    '.env.example': '\ue615',
    '.eslintrc.json': '\uf0c8a',
    '.prettierrc': '\uf0c8a',
    'vite.config.ts': '\ue628',
    'webpack.config.js': '\ueb29',
    'bun.lockb': '\ue718',
    'yarn.lock': '\ue718',
    'pnpm-lock.yaml': '\ue718',
}

const EXTENSION_ICONS: Record<string, string> = {
    ts: '\ue628',
    tsx: '\ue628',
    js: '\ue781',
    jsx: '\ue781',
    mjs: '\ue781',
    cjs: '\ue781',
    py: '\ue73c',
    rs: '\ue7a8',
    go: '\ue626',
    c: '\ue61e',
    cpp: '\ue61d',
    h: '\ue61e',
    hpp: '\ue61d',
    java: '\ue738',
    rb: '\ue791',
    lua: '\ue620',
    sh: '\ue795',
    bash: '\ue795',
    zsh: '\ue795',
    fish: '\ue795',
    html: '\ue736',
    htm: '\ue736',
    css: '\ue749',
    scss: '\ue749',
    sass: '\ue749',
    less: '\ue749',
    json: '\ue60b',
    yaml: '\ue60b',
    yml: '\ue60b',
    toml: '\ue60b',
    xml: '\uf05c0',
    md: '\uf48a',
    mdx: '\uf48a',
    nix: '\uf313',
    sql: '\ue706',
    vim: '\ue62b',
    png: '\uf03e',
    jpg: '\uf03e',
    jpeg: '\uf03e',
    gif: '\uf03e',
    svg: '\uf03e',
    ico: '\uf03e',
    webp: '\uf03e',
    zip: '\uf410',
    tar: '\uf410',
    gz: '\uf410',
    bz2: '\uf410',
    xz: '\uf410',
    '7z': '\uf410',
    rar: '\uf410',
    lock: '\uf023',
    pdf: '\uf1c1',
    txt: '\uf15c',
    log: '\uf15c',
    diff: '\uf440',
    patch: '\uf440',
}

export const ERROR_ICON = '\uf127'
export const ERROR_ICON_PLAIN = '!'

export function getFileIcon(
    name: string,
    type: 'file' | 'directory' | 'symlink',
    isExpanded: boolean,
    nerdFont = true,
): string {
    if (type === 'symlink') {
        return nerdFont ? '\uf481' : 'l'
    }
    if (type === 'directory') {
        if (!nerdFont) return isExpanded ? 'v' : '>'
        return isExpanded ? '\uf115' : '\uf114'
    }

    if (!nerdFont) return '-'

    const lower = name.toLowerCase()
    const filenameIcon = FILENAME_ICONS[lower]
    if (filenameIcon) return filenameIcon

    const dotIndex = lower.lastIndexOf('.')
    if (dotIndex !== -1) {
        const ext = lower.slice(dotIndex + 1)
        const extIcon = EXTENSION_ICONS[ext]
        if (extIcon) return extIcon
    }

    return '\uf15b'
}
