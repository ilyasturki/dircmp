import fsp from 'node:fs/promises'

interface FileCheckOptions {
    stat: boolean
}

export async function runFileCheck(
    leftFile: string,
    rightFile: string,
    options: FileCheckOptions,
): Promise<void> {
    const [leftContent, rightContent] = await Promise.all([
        fsp.readFile(leftFile),
        fsp.readFile(rightFile),
    ])

    const identical = leftContent.equals(rightContent)

    if (options.stat) {
        console.log(identical ? 'Identical' : '1 modified')
    }

    process.exit(identical ? 0 : 1)
}
