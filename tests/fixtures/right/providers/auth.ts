import { hash } from 'crypto'

export async function authenticate(token: string): Promise<boolean> {
    const decoded = Buffer.from(token, 'base64').toString()
    const [user, pass] = decoded.split(':')
    if (!user || !pass) return false
    return verify(user, pass)
}

async function verify(user: string, pass: string): Promise<boolean> {
    const hashed = hash('sha256', pass)
    const stored = await lookupUser(user)
    return stored === hashed
}

async function lookupUser(user: string): Promise<string | null> {
    // TODO: implement actual lookup
    return null
}
