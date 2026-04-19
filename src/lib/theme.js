export const THEME_STORAGE_KEY = 'pokepop-theme'

export function getStoredTheme() {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

export function applyTheme(mode) {
  if (typeof document === 'undefined') return
  document.body.dataset.theme = mode
  document.documentElement.dataset.theme = mode
  window.localStorage.setItem(THEME_STORAGE_KEY, mode)
}
