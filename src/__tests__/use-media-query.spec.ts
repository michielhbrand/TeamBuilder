import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useMediaQuery } from '@/lib/use-media-query'

type Listener = (event: { matches: boolean }) => void

let matches = false
let listeners: Listener[] = []

function setMatches(value: boolean): void {
  matches = value
  for (const listener of listeners) {
    listener({ matches: value })
  }
}

describe('useMediaQuery', () => {
  beforeEach(() => {
    matches = false
    listeners = []
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        media: query,
        get matches() {
          return matches
        },
        addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
        removeEventListener: (_type: string, listener: Listener) => {
          listeners = listeners.filter((item) => item !== listener)
        },
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reflects the initial match', () => {
    matches = true
    const scope = effectScope()
    const result = scope.run(() => useMediaQuery('(max-width: 720px)'))

    expect(result?.value).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 720px)')
    scope.stop()
  })

  it('updates when the media query changes', () => {
    const scope = effectScope()
    const result = scope.run(() => useMediaQuery('(max-width: 720px)'))

    expect(result?.value).toBe(false)
    setMatches(true)
    expect(result?.value).toBe(true)
    setMatches(false)
    expect(result?.value).toBe(false)
    scope.stop()
  })

  it('removes its listener when the scope stops', () => {
    const scope = effectScope()
    const result = scope.run(() => useMediaQuery('(max-width: 720px)'))

    expect(listeners).toHaveLength(1)
    scope.stop()
    expect(listeners).toHaveLength(0)
    setMatches(true)
    expect(result?.value).toBe(false)
  })
})
