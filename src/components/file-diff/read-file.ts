import fsp from 'node:fs/promises'

import { isBinary } from '~/utils/binary'

const MAX_DIFF_SIZE = 1_000_000

export async function readFileForDiff(
    filePath: string,
): Promise<{ content: string } | { error: string }> {
    const buf = await fsp.readFile(filePath)
    if (buf.length > MAX_DIFF_SIZE) {
        return { error: 'File too large to diff inline' }
    }
    if (isBinary(buf)) {
        return { error: 'Binary file — cannot display diff' }
    }
    return { content: buf.toString('utf-8') }
}
