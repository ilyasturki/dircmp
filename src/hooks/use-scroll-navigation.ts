import type { Key } from 'ink'
import { useCallback, useRef, useState } from 'react'

interface UseScrollNavigationOptions {
    totalLines: number
    maxVisibleLines: number
    /** Use gg (two-press) vs g (single press) for go-to-top. Default: true (gg). */
    useDoubleG?: boolean
}

interface UseScrollNavigationResult {
    scrollOffset: number
    setScrollOffset: React.Dispatch<React.SetStateAction<number>>
    maxScroll: number
    /** Call inside useInput. Returns true if the key was consumed. */
    handleInput: (input: string, key: Key) => boolean
}

export function useScrollNavigation({
    totalLines,
    maxVisibleLines,
    useDoubleG = true,
}: UseScrollNavigationOptions): UseScrollNavigationResult {
    const [scrollOffset, setScrollOffset] = useState(0)
    const pendingGRef = useRef(false)

    const maxScroll = Math.max(0, totalLines - maxVisibleLines)

    const handleInput = useCallback(
        (input: string, key: Key): boolean => {
            if (input === 'j' || key.downArrow) {
                setScrollOffset((prev) => Math.min(maxScroll, prev + 1))
                return true
            }
            if (input === 'k' || key.upArrow) {
                setScrollOffset((prev) => Math.max(0, prev - 1))
                return true
            }
            if (input === 'G') {
                setScrollOffset(maxScroll)
                return true
            }

            if (useDoubleG) {
                if (input === 'g') {
                    if (pendingGRef.current) {
                        pendingGRef.current = false
                        setScrollOffset(0)
                    } else {
                        pendingGRef.current = true
                    }
                    return true
                }
                pendingGRef.current = false
            } else {
                if (input === 'g') {
                    setScrollOffset(0)
                    return true
                }
            }

            if (key.ctrl && input === 'd') {
                const half = Math.floor(maxVisibleLines / 2)
                setScrollOffset((prev) => Math.min(maxScroll, prev + half))
                return true
            }
            if (key.ctrl && input === 'u') {
                const half = Math.floor(maxVisibleLines / 2)
                setScrollOffset((prev) => Math.max(0, prev - half))
                return true
            }
            if (key.ctrl && input === 'f') {
                setScrollOffset((prev) =>
                    Math.min(maxScroll, prev + maxVisibleLines),
                )
                return true
            }
            if (key.ctrl && input === 'b') {
                setScrollOffset((prev) => Math.max(0, prev - maxVisibleLines))
                return true
            }

            return false
        },
        [maxScroll, maxVisibleLines, useDoubleG],
    )

    return { scrollOffset, setScrollOffset, maxScroll, handleInput }
}
