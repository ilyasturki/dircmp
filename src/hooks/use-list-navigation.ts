import type { Key } from 'ink'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseListNavigationOptions {
    itemCount: number
    maxVisibleItems: number
    initialIndex?: number
}

interface UseListNavigationResult {
    selectedIndex: number
    scrollOffset: number
    setSelectedIndex: React.Dispatch<React.SetStateAction<number>>
    setScrollOffset: React.Dispatch<React.SetStateAction<number>>
    scrollTo: (index: number) => void
    /** Call inside useInput. Returns true if the key was consumed. */
    handleInput: (input: string, key: Key) => boolean
}

export function useListNavigation({
    itemCount,
    maxVisibleItems,
    initialIndex = 0,
}: UseListNavigationOptions): UseListNavigationResult {
    const [selectedIndex, setSelectedIndex] = useState(initialIndex)
    const [scrollOffset, setScrollOffset] = useState(0)
    const pendingGRef = useRef(false)

    // Clamp selectedIndex when itemCount shrinks (e.g. search filter)
    useEffect(() => {
        if (itemCount > 0 && selectedIndex >= itemCount) {
            setSelectedIndex(itemCount - 1)
        }
    }, [itemCount, selectedIndex])

    const scrollTo = useCallback(
        (index: number) => {
            setSelectedIndex(index)
            setScrollOffset((offset) => {
                if (index < offset) return index
                if (index >= offset + maxVisibleItems)
                    return index - maxVisibleItems + 1
                return offset
            })
        },
        [maxVisibleItems],
    )

    const handleInput = useCallback(
        (input: string, key: Key): boolean => {
            if (input === 'j' || key.downArrow) {
                scrollTo(Math.min(itemCount - 1, selectedIndex + 1))
                return true
            }
            if (input === 'k' || key.upArrow) {
                scrollTo(Math.max(0, selectedIndex - 1))
                return true
            }
            if (input === 'G') {
                scrollTo(itemCount - 1)
                return true
            }

            // gg — go to top
            if (input === 'g') {
                if (pendingGRef.current) {
                    pendingGRef.current = false
                    scrollTo(0)
                } else {
                    pendingGRef.current = true
                }
                return true
            }
            pendingGRef.current = false

            if (key.ctrl && input === 'd') {
                const jump = Math.floor(maxVisibleItems / 2)
                scrollTo(Math.min(itemCount - 1, selectedIndex + jump))
                return true
            }
            if (key.ctrl && input === 'u') {
                const jump = Math.floor(maxVisibleItems / 2)
                scrollTo(Math.max(0, selectedIndex - jump))
                return true
            }
            if (key.ctrl && input === 'f') {
                scrollTo(
                    Math.min(itemCount - 1, selectedIndex + maxVisibleItems),
                )
                return true
            }
            if (key.ctrl && input === 'b') {
                scrollTo(Math.max(0, selectedIndex - maxVisibleItems))
                return true
            }

            return false
        },
        [itemCount, maxVisibleItems, selectedIndex, scrollTo],
    )

    return {
        selectedIndex,
        scrollOffset,
        setSelectedIndex,
        setScrollOffset,
        scrollTo,
        handleInput,
    }
}
