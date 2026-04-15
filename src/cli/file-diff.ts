import fsp from 'node:fs/promises'
import { diffLines } from 'diff'

import { ansiFor, ansiReset } from '~/utils/theme'

const RED = ansiFor('diffRemovedLine')
const GREEN = ansiFor('diffAddedLine')
const RESET = ansiReset

export async function runFileDiff(
    leftFile: string,
    rightFile: string,
): Promise<void> {
    const [leftContent, rightContent] = await Promise.all([
        fsp.readFile(leftFile, 'utf-8'),
        fsp.readFile(rightFile, 'utf-8'),
    ])

    const changes = diffLines(leftContent, rightContent)
    let hasChanges = false

    for (const change of changes) {
        if (change.added) {
            hasChanges = true
            for (const line of change.value.replace(/\n$/, '').split('\n')) {
                console.log(`${GREEN}+ ${line}${RESET}`)
            }
        } else if (change.removed) {
            hasChanges = true
            for (const line of change.value.replace(/\n$/, '').split('\n')) {
                console.log(`${RED}- ${line}${RESET}`)
            }
        }
    }

    if (!hasChanges) {
        console.log('Files are identical')
    }
}
