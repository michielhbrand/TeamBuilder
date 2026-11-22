import { describe, expect, it } from 'vitest'
import { friendlyError } from '@/lib/fit-errors'

describe('friendlyError', () => {
  it('points to the Kilo API key only when the key is missing', () => {
    expect(friendlyError('Kilo is not configured. Ask an administrator to set KILO_API_KEY.')).toBe(
      'Fit analysis is not configured. Ask an administrator to set the Kilo API key.',
    )
  })

  it('does not hide model errors that mention configuring a model', () => {
    const reasoning =
      'Kilo routed to "vendor/model", which used 700 reasoning tokens. Configure a non-reasoning free model.'

    expect(friendlyError(reasoning)).toBe(reasoning)
    expect(friendlyError('Kilo is not configured with a free model.')).toBe(
      'Kilo is not configured with a free model.',
    )
  })

  it('keeps the rate-limit message', () => {
    expect(friendlyError('The free model is rate-limited right now. Try again later.')).toBe(
      'The free model is rate-limited right now. Try again later.',
    )
  })
})
