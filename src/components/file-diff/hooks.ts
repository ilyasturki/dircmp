import fs from 'node:fs'
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
    reloadKey: number = 0,
    context?: number,
): {
    diffRows: DiffRow[] | null
    error: string | null
    leftContent: string
    rightContent: string
} {
    const [diffRows, setDiffRows] = useState<DiffRow[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [leftContent, setLeftContent] = useState('')
    const [rightContent, setRightContent] = useState('')

    useEffect(() => {
        let cancelled = false
        setError(null)
        setDiffRows(null)

        async function load() {
            try {
                let leftText = ''
                let rightText = ''

                const leftExists =
                    entry.status !== 'only-right' && fs.existsSync(leftPath)
                const rightExists =
                    entry.status !== 'only-left' && fs.existsSync(rightPath)

                if (leftExists) {
                    const result = await readFileForDiff(leftPath)
                    if (cancelled) return
                    if ('error' in result) {
                        setError(result.error)
                        return
                    }
                    leftText = result.content
                }

                if (rightExists) {
                    const result = await readFileForDiff(rightPath)
                    if (cancelled) return
                    if ('error' in result) {
                        setError(result.error)
                        return
                    }
                    rightText = result.content
                }

                const computed = computeDiffRows(
                    leftText,
                    rightText,
                    entry.relativePath,
                    entry.relativePath,
                    context,
                )

                if (cancelled) return
                setLeftContent(leftText)
                setRightContent(rightText)
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
    }, [entry, leftPath, rightPath, reloadKey, context])

    return { diffRows, error, leftContent, rightContent }
}

export function useLineNavigation(
    changeLineIndices: number[],
    isActive: boolean,
): {
    lineCursor: number
    setLineCursor: React.Dispatch<React.SetStateAction<number>>
} {
    const [lineCursor, setLineCursor] = useState(0)
    useInput(
        (input, key) => {
            if (changeLineIndices.length === 0) return
            if (input === 'j' || key.downArrow) {
                setLineCursor((prev) =>
                    Math.min(changeLineIndices.length - 1, prev + 1),
                )
            } else if (input === 'k' || key.upArrow) {
                setLineCursor((prev) => Math.max(0, prev - 1))
            } else if (input === 'G') {
                setLineCursor(changeLineIndices.length - 1)
            } else if (input === 'g') {
                setLineCursor(0)
            }
        },
        { isActive },
    )
    return { lineCursor, setLineCursor }
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
    contextPadding: number = 0,
): {
    scrollOffset: number
    setScrollOffset: React.Dispatch<React.SetStateAction<number>>
} {
    const [scrollOffset, setScrollOffset] = useState(0)
    useEffect(() => {
        if (!focusedRange) return
        const maxScroll = Math.max(0, totalRows - contentHeight)
        const extStart = Math.max(0, focusedRange.start - contextPadding)
        const extEnd = Math.min(
            Math.max(0, totalRows - 1),
            focusedRange.end + contextPadding,
        )
        setScrollOffset((prev) => {
            if (extStart < prev) return extStart
            if (extEnd >= prev + contentHeight) {
                const offsetToShowEnd = extEnd - contentHeight + 1
                return Math.max(
                    0,
                    Math.min(offsetToShowEnd, extStart, maxScroll),
                )
            }
            return prev
        })
    }, [focusedRange, totalRows, contentHeight, contextPadding])
    return { scrollOffset, setScrollOffset }
}

export function useViewportShortcuts(
    referenceLine: number | undefined,
    contentHeight: number,
    totalRows: number,
    setScrollOffset: React.Dispatch<React.SetStateAction<number>>,
    isActive: boolean,
): void {
    const pendingZRef = useRef(false)
    useInput(
        (input, key) => {
            const h = Math.max(1, contentHeight)
            const maxScroll = Math.max(0, totalRows - h)

            if (key.ctrl && input === 'e') {
                pendingZRef.current = false
                setScrollOffset((prev) => Math.min(maxScroll, prev + 1))
                return
            }
            if (key.ctrl && input === 'y') {
                pendingZRef.current = false
                setScrollOffset((prev) => Math.max(0, prev - 1))
                return
            }
            if (key.ctrl || key.meta) {
                pendingZRef.current = false
                return
            }
            if (pendingZRef.current) {
                pendingZRef.current = false
                if (referenceLine === undefined) return
                if (input === 'z') {
                    setScrollOffset(
                        Math.max(0, referenceLine - Math.floor(h / 2)),
                    )
                } else if (input === 't') {
                    setScrollOffset(Math.max(0, referenceLine))
                } else if (input === 'b') {
                    setScrollOffset(Math.max(0, referenceLine - h + 1))
                }
            } else if (input === 'z') {
                pendingZRef.current = true
            }
        },
        { isActive },
    )
}
