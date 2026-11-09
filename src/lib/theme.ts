export const THEME_STORAGE_KEY = 'orbital-theme'
export const lightThemeName = 'orbitalLight'
export const darkThemeName = 'orbitalDark'

export function readStoredTheme(): string {
  if (typeof localStorage === 'undefined') {
    return lightThemeName
  }

  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  return saved === darkThemeName || saved === 'dark' ? darkThemeName : lightThemeName
}

export function persistTheme(name: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, name)
  }
}
