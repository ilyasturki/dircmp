export interface Connection {
    host: string
    port: number
    database: string
}

export function connect(config: Connection): void {
    console.log(`Connecting to ${config.host}:${config.port}/${config.database}`)
}

export function disconnect(): void {
    console.log('Disconnected')
}
