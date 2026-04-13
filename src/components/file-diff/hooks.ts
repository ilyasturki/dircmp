import { useInput } from 'ink'
import { useEffect, useRef, useState } from 'react'

import type { CompareEntry } from '~/utils/types'
import type { DiffRow, HunkRange } from './diff-compute'
import { computeDiffRows } from './diff-compute'
import { readFileForDiff } from './read-file'

export function useDiffRows(
    entry: CompareEntry,
    leftPath: string,
    rightPath: string,
): { diffRows: DiffRow[] | null; error: string | null } {
    const [diffRows, setDiffRows] = useState<DiffRow[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                let leftContent = ''
                let rightContent = ''

                if (entry.status !== 'only-right') {
                    const result = await readFileForDiff(leftPath)
                    if (cancelled) return
                    if ('error' in result) {
                        setError(result.error)
                        return
                    }
                    leftContent = result.content
                }

                if (entry.status !== 'only-left') {
                    const result = await readFileForDiff(rightPath)
                    if (cancelled) return
                    if ('error' in result) {
                        setError(result.error)
                        return
                    }
                    rightContent = result.content
                }

                const computed = computeDiffRows(
                    leftContent,
                    rightContent,
                    entry.relativePath,
                    entry.relativePath,
                )

                if (cancelled) return
                if (computed.length === 0) {
                    setError('Files are identical')
                } else {
                    setDiffRows(computed)
                }
            } catch (e) {
                if (!cancelled) {
                    setError(
                        e instanceof Error ? e.message : 'Failed to read file',
                    )
                }
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [entry, leftPath, rightPath])

    return { diffRows, error }
}

export function useHunkNavigation(
    hunkRanges: HunkRange[],
    isActive: boolean,
): number {
    const [focusedHunk, setFocusedHunk] = useState(0)
    const pendingGRef = useRef(false)

    useInput(
        (input, key) => {
            if (hunkRanges.length === 0) return
            if (input === 'j' || key.downArrow) {
                setFocusedHunk((prev) =>
                    Math.min(hunkRanges.length - 1, prev + 1),
                )
                pendingGRef.current = false
            } else if (input === 'k' || key.upArrow) {
                setFocusedHunk((prev) => Math.max(0, prev - 1))
                pendingGRef.current = false
            } else if (input === 'G') {
                setFocusedHunk(hunkRanges.length - 1)
                pendingGRef.current = false
            } else if (input === 'g') {
                if (pendingGRef.current) {
                    setFocusedHunk(0)
                    pendingGRef.current = false
                } else {
                    pendingGRef.current = true
                }
            } else {
                pendingGRef.current = false
            }
        },
        { isActive },
    )

    return focusedHunk
}

export function useAutoScroll(
    focusedRange: HunkRange | undefined,
    totalRows: number,
    contentHeight: number,
): number {
    const [scrollOffset, setScrollOffset] = useState(0)
    useEffect(() => {
        if (!focusedRange) return
        const maxScroll = Math.max(0, totalRows - contentHeight)
        setScrollOffset((prev) => {
            if (focusedRange.start < prev) return focusedRange.start
            if (focusedRange.end >= prev + contentHeight) {
                return Math.min(focusedRange.start, maxScroll)
            }
            return prev
        })
    }, [focusedRange, totalRows, contentHeight])
    return scrollOffset
}
