import { hash } from 'crypto'

export async function authenticate(token: string): Promise<boolean> {
    const decoded = Buffer.from(token, 'base64').toString()
    const [user, pass] = decoded.split(':')
    return verify(user, pass)
}

async function verify(user: string, pass: string): Promise<boolean> {
    const hashed = hash('sha256', pass)
    // TODO: check against database
    return hashed.length > 0
}
