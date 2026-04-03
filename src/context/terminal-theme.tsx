import { createContext, useContext } from 'react'

type TerminalTheme = 'dark' | 'light'

const TerminalThemeContext = createContext<TerminalTheme>('dark')

export const TerminalThemeProvider = TerminalThemeContext.Provider

export function useTerminalTheme(): TerminalTheme {
    return useContext(TerminalThemeContext)
}
