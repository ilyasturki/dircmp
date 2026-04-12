export interface EmailOptions {
    to: string
    subject: string
    body: string
}

export async function send(options: EmailOptions): Promise<void> {
    console.log(`Sending email to ${options.to}: ${options.subject}`)
}
