import { beforeEach, describe, expect, it } from 'vitest'
import {
  darkThemeName,
  lightThemeName,
  persistTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from '@/lib/theme'

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to light when the user has never toggled the theme', () => {
    expect(readStoredTheme()).toBe(lightThemeName)
  })

  it('reads a persisted dark theme', () => {
    persistTheme(darkThemeName)

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(darkThemeName)
    expect(readStoredTheme()).toBe(darkThemeName)
  })

  it('accepts the legacy dark storage value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    expect(readStoredTheme()).toBe(darkThemeName)
  })
})
