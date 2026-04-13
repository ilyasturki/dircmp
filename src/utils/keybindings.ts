import type { Key } from 'ink'
import fs from 'node:fs'
import path from 'node:path'

import type { Shortcut } from '~/keymap'
import { getConfigDir } from './paths'

export type KeyDef = string | string[] | null

export type KeybindingOverrides = Record<string, KeyDef>

interface ParsedKey {
    match: (input: string, key: Key) => boolean
    label: string
    sequence?: string
}

const SPECIAL_KEYS: Record<
    string,
    { match: (input: string, key: Key) => boolean; label: string }
> = {
    up: { match: (_, key) => key.upArrow, label: '↑' },
    down: { match: (_, key) => key.downArrow, label: '↓' },
    left: { match: (_, key) => key.leftArrow, label: '←' },
    right: { match: (_, key) => key.rightArrow, label: '→' },
    tab: { match: (_, key) => key.tab, label: 'Tab' },
    enter: { match: (_, key) => key.return, label: 'Enter' },
    return: { match: (_, key) => key.return, label: 'Enter' },
    escape: { match: (_, key) => key.escape, label: 'Esc' },
    esc: { match: (_, key) => key.escape, label: 'Esc' },
    backspace: { match: (_, key) => key.backspace, label: 'Backspace' },
    delete: { match: (_, key) => key.delete, label: 'Delete' },
    space: { match: (input) => input === ' ', label: 'Space' },
}

function parseKeyString(keyStr: string): ParsedKey {
    // Modifier prefix (ctrl+x)
    const plusIndex = keyStr.indexOf('+')
    if (plusIndex !== -1) {
        const modifier = keyStr.slice(0, plusIndex).toLowerCase()
        const keyPart = keyStr.slice(plusIndex + 1)
        if (modifier === 'ctrl') {
            return {
                match: (input, key) =>
                    key.ctrl && input === keyPart.toLowerCase(),
                label: `Ctrl+${keyPart}`,
            }
        }
    }

    // Special key name
    const special = SPECIAL_KEYS[keyStr.toLowerCase()]
    if (special) {
        return { match: special.match, label: special.label }
    }

    // Single character
    if (keyStr.length === 1) {
        return {
            match: (input) => input === keyStr,
            label: keyStr,
        }
    }

    // Sequence (multi-char like "gg", "zR", "]c")
    return {
        match: () => false,
        label: keyStr,
        sequence: keyStr,
    }
}

export function parseKeyDef(def: string | string[]): ParsedKey {
    if (typeof def === 'string') {
        return parseKeyString(def)
    }

    const parsed = def.map(parseKeyString)

    // Sequences can't be combined with other keys in an array
    const seqKey = parsed.find((p) => p.sequence)
    if (seqKey) return seqKey

    return {
        match: (input, key) => parsed.some((p) => p.match(input, key)),
        label: parsed.map((p) => p.label).join('/'),
    }
}

const VALID_MODIFIERS = new Set(['ctrl'])

function validateKeyString(keyStr: string): string | null {
    if (keyStr.length === 0) return 'Empty key'

    // Modifier prefix
    const plusIndex = keyStr.indexOf('+')
    if (plusIndex !== -1) {
        const modifier = keyStr.slice(0, plusIndex).toLowerCase()
        const keyPart = keyStr.slice(plusIndex + 1)
        if (!VALID_MODIFIERS.has(modifier))
            return `Unknown modifier "${modifier}"`
        if (keyPart.length !== 1)
            return `Modifier key must be a single character, got "${keyPart}"`
        return null
    }

    // Special key name
    if (keyStr.toLowerCase() in SPECIAL_KEYS) return null

    // Single character
    if (keyStr.length === 1) return null

    // Sequence — only printable characters allowed
    if (/^[\x20-\x7e]+$/.test(keyStr)) return null

    return `Invalid key "${keyStr}"`
}

export function validateKeyDef(def: string | string[]): string | null {
    if (typeof def === 'string') return validateKeyString(def)
    if (def.length === 0) return 'No keys specified'
    for (const key of def) {
        // Arrays can't contain sequences
        if (
            key.length > 1
            && key.indexOf('+') === -1
            && !(key.toLowerCase() in SPECIAL_KEYS)
        ) {
            return `Sequences like "${key}" cannot be combined with other keys`
        }
        const err = validateKeyString(key)
        if (err) return err
    }
    return null
}

function getKeybindingsPath(): string {
    return path.join(getConfigDir(), 'keybindings.json')
}

export function loadKeybindings(): KeybindingOverrides {
    try {
        const raw = fs.readFileSync(getKeybindingsPath(), 'utf-8')
        const parsed = JSON.parse(raw)
        if (
            typeof parsed !== 'object'
            || parsed === null
            || Array.isArray(parsed)
        )
            return {}

        const result: KeybindingOverrides = {}
        for (const [id, value] of Object.entries(parsed)) {
            if (
                value === null
                || typeof value === 'string'
                || (Array.isArray(value)
                    && value.every((v) => typeof v === 'string'))
            ) {
                result[id] = value as KeyDef
            }
        }
        return result
    } catch {
        return {}
    }
}

export function resolveKeymap(
    defaults: Shortcut[],
    overrides: KeybindingOverrides,
): Shortcut[] {
    return defaults
        .map((shortcut) => {
            if (!(shortcut.id in overrides)) return shortcut
            const override = overrides[shortcut.id]
            if (override === null) return null

            const parsed = parseKeyDef(override)
            return {
                ...shortcut,
                match: parsed.match,
                keyDef: override,
                keyLabel: shortcut.keyLabel !== '' ? parsed.label : '',
                helpKey: parsed.label,
                sequence: parsed.sequence,
            }
        })
        .filter((s): s is Shortcut => s !== null)
}

export async function saveKeybindings(
    overrides: KeybindingOverrides,
): Promise<void> {
    const keybindingsPath = getKeybindingsPath()
    await fs.promises.mkdir(path.dirname(keybindingsPath), { recursive: true })
    await fs.promises.writeFile(
        keybindingsPath,
        JSON.stringify(overrides, null, 2) + '\n',
    )
}

export function formatKeyDef(override: KeyDef): string {
    if (override === null) return ''
    if (typeof override === 'string') return override
    return override.join(', ')
}
