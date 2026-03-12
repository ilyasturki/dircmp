import { createContext, useContext, useMemo } from 'react'

const DateLocaleContext = createContext<string | undefined>(undefined)

export const DateLocaleProvider = DateLocaleContext.Provider

export function useDateFormatter(): Intl.DateTimeFormat {
    const locale = useContext(DateLocaleContext)
    return useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }),
        [locale],
    )
}
