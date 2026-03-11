import type { DOMElement } from 'ink'
import type { ReactNode } from 'react'
import { Box, measureElement, Text } from 'ink'
import { useEffect, useRef, useState } from 'react'

interface DialogProps {
    title: string
    columns: number
    rows: number
    children: ReactNode
}

export function Dialog({ title, columns, rows, children }: DialogProps) {
    const ref = useRef<DOMElement>(null)
    const [dims, setDims] = useState({ width: 0, height: 0 })

    useEffect(() => {
        if (ref.current) {
            setDims(measureElement(ref.current))
        }
    })

    return (
        <Box
            position='absolute'
            width={columns}
            height={rows}
            justifyContent='center'
            alignItems='center'
        >
            <Box>
                {/* Backdrop sized to dialog only */}
                {dims.width > 0 && (
                    <Box
                        position='absolute'
                        flexDirection='column'
                    >
                        {Array.from({ length: dims.height }, (_, i) => (
                            <Text key={i}>{' '.repeat(dims.width)}</Text>
                        ))}
                    </Box>
                )}
                {/* Dialog box */}
                <Box
                    ref={ref}
                    flexDirection='column'
                    borderStyle='bold'
                    borderColor='cyan'
                    paddingX={2}
                    paddingY={1}
                    gap={1}
                >
                    <Text
                        bold
                        underline
                    >
                        {title}
                    </Text>

                    {children}
                </Box>
            </Box>
        </Box>
    )
}
