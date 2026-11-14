import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../styles/orbital.css'), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const end = css.indexOf('}', start)
  const vars: Record<string, string> = {}
  for (const match of css.slice(start, end).matchAll(/(--orbital-[\w-]+):\s*([^;]+);/g)) {
    vars[match[1] ?? ''] = (match[2] ?? '').trim()
  }
  return vars
}

const themes = {
  light: block('.v-theme--orbitalLight'),
  dark: block('.v-theme--orbitalDark'),
}

type Rgba = [number, number, number, number]

function parse(color: string): Rgba {
  const hex = color.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1] ?? '0', 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgba = color.match(/^rgba?\(([^)]+)\)$/)
  if (rgba) {
    const [r, g, b, a = '1'] = (rgba[1] ?? '').split(',').map((part) => part.trim())
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  throw new Error(`Unsupported color ${color}`)
}

function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3]
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]
}

function luminance([r, g, b]: Rgba): number {
  const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function contrast(a: string, b: string, base = '#ffffff'): number {
  const baseColor = parse(base)
  const first = luminance(composite(parse(a), baseColor))
  const second = luminance(composite(parse(b), baseColor))
  const [hi, lo] = first > second ? [first, second] : [second, first]
  return (hi + 0.05) / (lo + 0.05)
}

describe.each(Object.entries(themes))('%s theme tokens', (_name, values) => {
  const vars = (token: string): string => values[token] ?? ''
  it('defines all four new tokens', () => {
    for (const token of [
      '--orbital-line-input',
      '--orbital-signal-text',
      '--orbital-warn',
      '--orbital-warn-soft',
    ]) {
      expect(values[token] !== undefined).toBe(true)
    }
  })

  it('input border is at least 3:1 against surface', () => {
    expect(
      contrast(vars('--orbital-line-input'), vars('--orbital-surface')),
    ).toBeGreaterThanOrEqual(3)
  })

  it('signal text is at least 4.5:1 on surface and on signal-soft', () => {
    const surface = vars('--orbital-surface')
    const text = vars('--orbital-signal-text')
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(text, vars('--orbital-signal-soft'), surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('warn is at least 4.5:1 on warn-soft and on surface', () => {
    const surface = vars('--orbital-surface')
    const warn = vars('--orbital-warn')
    expect(contrast(warn, surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(warn, vars('--orbital-warn-soft'), surface)).toBeGreaterThanOrEqual(4.5)
  })
})
