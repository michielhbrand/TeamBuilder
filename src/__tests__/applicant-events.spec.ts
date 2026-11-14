import { describe, expect, it } from 'vitest'
import { formatEventTime, formatRelativeTime } from '@/lib/applicant-events'

const now = new Date('2026-11-14T12:00:00Z')

function ago(ms: number): string {
  return new Date(now.getTime() - ms).toISOString()
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

describe('formatRelativeTime', () => {
  it('says just now under a minute and for future timestamps', () => {
    expect(formatRelativeTime(ago(30_000), now)).toBe('just now')
    expect(formatRelativeTime(ago(-5 * MINUTE), now)).toBe('just now')
  })

  it('formats minutes', () => {
    expect(formatRelativeTime(ago(MINUTE), now)).toBe('1 minute ago')
    expect(formatRelativeTime(ago(5 * MINUTE), now)).toBe('5 minutes ago')
  })

  it('formats hours', () => {
    expect(formatRelativeTime(ago(HOUR), now)).toBe('1 hour ago')
    expect(formatRelativeTime(ago(3 * HOUR), now)).toBe('3 hours ago')
  })

  it('says yesterday for 24 to 47 hours', () => {
    expect(formatRelativeTime(ago(24 * HOUR), now)).toBe('yesterday')
    expect(formatRelativeTime(ago(47 * HOUR), now)).toBe('yesterday')
  })

  it('formats days', () => {
    expect(formatRelativeTime(ago(6 * DAY), now)).toBe('6 days ago')
  })

  it('falls back to the absolute time at 30 days', () => {
    const createdAt = ago(30 * DAY)
    expect(formatRelativeTime(createdAt, now)).toBe(formatEventTime(createdAt))
  })
})
