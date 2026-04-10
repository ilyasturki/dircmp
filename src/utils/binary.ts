export function isBinary(buffer: Buffer): boolean {
    for (let i = 0; i < Math.min(buffer.length, 8000); i++) {
        if (buffer[i] === 0) return true
    }
    return false
}
