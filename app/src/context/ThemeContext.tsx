import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Seven themes: 4 light + 3 dark.
 *   DARK  — terminal, feminine, fierce-focus
 *   LIGHT — luna-rose, opal-moon, luxe-silk, beach-sand
 */
export type Theme =
  | 'terminal'
  | 'feminine'
  | 'fierce-focus'
  | 'luna-rose'
  | 'opal-moon'
  | 'luxe-silk'
  | 'beach-sand'

export interface ThemeOption {
  id: Theme
  label: string
  swatch: string
  light: boolean
}

export const THEMES: ThemeOption[] = [
  { id: 'terminal', label: 'Terminal Modernist', swatch: '#eec35e', light: false },
  { id: 'feminine', label: 'Feminine · Dusty Rose', swatch: '#b76e79', light: false },
  { id: 'fierce-focus', label: 'Fierce Focus', swatch: '#e85c4f', light: false },
  { id: 'luna-rose', label: 'Luna Rose', swatch: '#c98a7e', light: true },
  { id: 'opal-moon', label: 'Opal Moon', swatch: '#9d80c4', light: true },
  { id: 'luxe-silk', label: 'Luxe Silk', swatch: '#a57e2e', light: true },
  { id: 'beach-sand', label: 'Beach Sand', swatch: '#a57e4e', light: true },
]

export const THEME_STORAGE_KEY = 'periodus.theme'

const THEME_META_COLOR: Record<Theme, string> = {
  terminal: '#16130b',
  feminine: '#161014',
  'fierce-focus': '#171410',
  'luna-rose': '#fffdfc',
  'opal-moon': '#fffdfc',
  'luxe-silk': '#fffdfc',
  'beach-sand': '#fffdfc',
}

const VALID_THEMES = new Set<Theme>(THEMES.map((t) => t.id))

function isTheme(value: string | null | undefined): value is Theme {
  return typeof value === 'string' && VALID_THEMES.has(value as Theme)
}

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'terminal'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'terminal'
  } catch {
    return 'terminal'
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_META_COLOR[theme])
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // ignore storage failures (e.g. private mode)
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
