import { createContext, useContext } from 'react'

const NerdFontContext = createContext<boolean>(true)

export const NerdFontProvider = NerdFontContext.Provider

export function useNerdFont(): boolean {
    return useContext(NerdFontContext)
}
