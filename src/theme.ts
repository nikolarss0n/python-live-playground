import { readPreference } from './useLearningSession'

export type ThemeMode = 'light' | 'dark'

export function preferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = readPreference('plp-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
}
