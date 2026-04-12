import path from 'node:path'
import { Box, useApp, useStdout } from 'ink'
import { useCallback } from 'react'

import type { Action, CompareEntry } from '~/utils/types'
import { FileDiff } from '~/components/file-diff'
import { useTerminalDimensions } from '~/hooks'

interface FileDiffAppProps {
    leftFile: string
    rightFile: string
}

export function FileDiffApp({ leftFile, rightFile }: FileDiffAppProps) {
    const { exit } = useApp()
    const { stdout } = useStdout()
    const { columns, rows } = useTerminalDimensions(stdout)

    const entry: CompareEntry = {
        relativePath: path.basename(leftFile),
        name: path.basename(leftFile),
        isDirectory: false,
        status: 'modified',
        depth: 0,
        isExpanded: false,
    }

    const dispatch = useCallback(
        (action: Action) => {
            if (action.type === 'HIDE_FILE_DIFF') {
                exit()
            }
        },
        [exit],
    )

    return (
        <Box
            flexDirection='column'
            height={rows}
        >
            <FileDiff
                entry={entry}
                leftDir=''
                rightDir=''
                leftFilePath={leftFile}
                rightFilePath={rightFile}
                dispatch={dispatch}
                columns={columns}
                rows={rows}
            />
        </Box>
    )
}
