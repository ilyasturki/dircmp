const store = new Map<string, { value: unknown; expires: number }>()

export function get(key: string): unknown | undefined {
    const entry = store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expires) {
        store.delete(key)
        return undefined
    }
    return entry.value
}

export function set(key: string, value: unknown, ttl = 300_000): void {
    store.set(key, { value, expires: Date.now() + ttl })
}
