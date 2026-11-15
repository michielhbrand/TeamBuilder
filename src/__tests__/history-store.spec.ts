import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { HireRecord, HiringMonth } from '@/types/history'

const mocks = vi.hoisted(() => ({
  fetchHiringMonthly: vi.fn<() => Promise<unknown>>(),
  fetchHireHistory: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/lib/history-api', () => mocks)

import { useHistoryStore } from '@/stores/history'

const month: HiringMonth = {
  month: '2026-10-01',
  department: 'Engineering',
  applicantsIn: 4,
  hired: 1,
  rejected: 2,
}

const hire: HireRecord = {
  applicantId: 'c1',
  department: 'Engineering',
  hiredOn: '2026-10-20',
  daysToHire: 18,
}

describe('history store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.fetchHiringMonthly.mockResolvedValue([month])
    mocks.fetchHireHistory.mockResolvedValue([hire])
  })

  it('loads months and hires on initialize', async () => {
    const history = useHistoryStore()

    await history.initialize()

    expect(history.months).toEqual([month])
    expect(history.hires).toEqual([hire])
    expect(history.initialized).toBe(true)
    expect(history.loading).toBe(false)
    expect(history.error).toBeNull()
  })

  it('initialize is idempotent', async () => {
    const history = useHistoryStore()

    await history.initialize()
    await history.initialize()

    expect(mocks.fetchHiringMonthly).toHaveBeenCalledOnce()
    expect(mocks.fetchHireHistory).toHaveBeenCalledOnce()
  })

  it('sets an error and stays uninitialized when a read fails', async () => {
    mocks.fetchHireHistory.mockRejectedValue(new Error('history unavailable'))
    const history = useHistoryStore()

    await history.initialize()

    expect(history.error).toBe('history unavailable')
    expect(history.initialized).toBe(false)
    expect(history.loading).toBe(false)
    expect(history.months).toEqual([])
    expect(history.hires).toEqual([])
  })

  it('can initialize again after a failed attempt', async () => {
    mocks.fetchHiringMonthly.mockRejectedValueOnce(new Error('history unavailable'))
    const history = useHistoryStore()

    await history.initialize()
    await history.initialize()

    expect(history.initialized).toBe(true)
    expect(history.error).toBeNull()
    expect(history.months).toEqual([month])
  })

  it('refresh does nothing before initialize', async () => {
    const history = useHistoryStore()

    await history.refresh()

    expect(mocks.fetchHiringMonthly).not.toHaveBeenCalled()
    expect(mocks.fetchHireHistory).not.toHaveBeenCalled()
  })

  it('refresh replaces data and clears a previous error', async () => {
    const history = useHistoryStore()
    await history.initialize()
    history.error = 'stale'
    const next = { ...month, hired: 3 }
    mocks.fetchHiringMonthly.mockResolvedValue([next])
    mocks.fetchHireHistory.mockResolvedValue([])

    await history.refresh()

    expect(history.months).toEqual([next])
    expect(history.hires).toEqual([])
    expect(history.error).toBeNull()
  })

  it('refresh keeps old data and sets an error when a read fails', async () => {
    const history = useHistoryStore()
    await history.initialize()
    mocks.fetchHiringMonthly.mockRejectedValue(new Error('offline'))

    await history.refresh()

    expect(history.months).toEqual([month])
    expect(history.hires).toEqual([hire])
    expect(history.error).toBe('offline')
    expect(history.initialized).toBe(true)
  })

  it('refresh ignores a call while another refresh is running', async () => {
    const history = useHistoryStore()
    await history.initialize()
    vi.clearAllMocks()
    let release: (value: unknown) => void = () => {}
    mocks.fetchHiringMonthly.mockReturnValue(new Promise((resolve) => (release = resolve)))

    const first = history.refresh()
    await history.refresh()
    release([month])
    await first

    expect(mocks.fetchHiringMonthly).toHaveBeenCalledOnce()
  })

  it('reset clears everything', async () => {
    const history = useHistoryStore()
    await history.initialize()
    history.error = 'stale'

    history.reset()

    expect(history.months).toEqual([])
    expect(history.hires).toEqual([])
    expect(history.initialized).toBe(false)
    expect(history.loading).toBe(false)
    expect(history.error).toBeNull()
  })
})
