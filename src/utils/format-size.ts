const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatSize(bytes: number): string {
    let unitIndex = 0
    let value = bytes

    while (value >= 1024 && unitIndex < UNITS.length - 1) {
        value /= 1024
        unitIndex++
    }

    const unit = UNITS[unitIndex]!
    const formatted =
        unitIndex === 0 ? String(Math.round(value))
        : value < 10 ? value.toFixed(1)
        : String(Math.round(value))

    return `${formatted} ${unit}`.padStart(7)
}
