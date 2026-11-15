import { describe, expect, it, vi } from 'vitest'
import { mapBoard } from '@/lib/api-shared'
import type { BoardRow } from '@/lib/api-shared'
import {
  PAGE_SIZE,
  fetchAllPages,
  fetchHireHistory,
  fetchHiringMonthly,
  mapHireRecord,
  mapHiringMonth,
} from '@/lib/history-api'
import { historyWindowStart } from '@/lib/overview'

const supabaseMock = vi.hoisted(() => ({ from: vi.fn<(table: string) => unknown>() }))

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }))

function chain(pages: unknown[][]) {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, unknown> = {}
  let page = 0
  for (const name of ['select', 'gte', 'order']) {
    builder[name] = vi.fn<(...args: unknown[]) => unknown>((...args) => {
      calls[name] = [...(calls[name] ?? []), args]
      return builder
    })
  }
  builder.range = vi.fn<(from: number, to: number) => unknown>((from, to) => {
    calls.range = [...(calls.range ?? []), [from, to]]
    return Promise.resolve({ data: pages[page++] ?? [], error: null })
  })
  return { builder, calls }
}

describe('history mappers', () => {
  it('maps a hiring_monthly row', () => {
    expect(
      mapHiringMonth({
        month: '2026-03-01',
        department: 'Engineering',
        applicants_in: 12,
        hired: 2,
        rejected: 5,
      }),
    ).toEqual({
      month: '2026-03-01',
      department: 'Engineering',
      applicantsIn: 12,
      hired: 2,
      rejected: 5,
    })
  })

  it('maps a hire_history row', () => {
    expect(
      mapHireRecord({
        applicant_id: 'a1',
        department: 'Design',
        hired_on: '2026-04-10',
        days_to_hire: 31,
      }),
    ).toEqual({ applicantId: 'a1', department: 'Design', hiredOn: '2026-04-10', daysToHire: 31 })
  })

  it('sets openedAt on a board from created_at', () => {
    const row: BoardRow = {
      id: 'b1',
      name: 'Backend',
      department: 'Engineering',
      open_positions: 1,
      deadline: '2026-12-01',
      created_at: '2026-01-01T00:00:00.000Z',
      job_spec_path: null,
      job_spec_name: null,
      board_columns: [],
      applicants: [],
    }
    expect(mapBoard(row).openedAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('historyWindowStart', () => {
  it('starts at the first day of the quarter eleven quarters back', () => {
    expect(historyWindowStart(new Date('2026-11-15T12:00:00Z'))).toBe('2024-01-01')
    expect(historyWindowStart(new Date('2026-02-01T00:00:00Z'))).toBe('2023-04-01')
    expect(historyWindowStart(new Date('2026-07-01T00:00:00Z'))).toBe('2023-10-01')
  })
})

describe('fetchAllPages', () => {
  it('keeps reading until a short page and concatenates the rows', async () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, index) => index)
    const page = vi
      .fn<(from: number, to: number) => PromiseLike<{ data: unknown; error: null }>>()
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: [1, 2, 3], error: null })

    const rows = await fetchAllPages<number>(page)

    expect(rows).toHaveLength(PAGE_SIZE + 3)
    expect(page.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('stops after one short page and throws on an error', async () => {
    const one = vi
      .fn<(from: number, to: number) => PromiseLike<{ data: unknown; error: null }>>()
      .mockResolvedValue({ data: [1], error: null })
    expect(await fetchAllPages(one)).toEqual([1])
    expect(one).toHaveBeenCalledOnce()

    await expect(
      fetchAllPages(() => Promise.resolve({ data: null, error: { message: 'denied' } })),
    ).rejects.toThrow('denied')
  })
})

describe('history fetchers', () => {
  it('reads hire history newest first inside the window and returns it oldest first', async () => {
    const row = (id: string, hired_on: string) => ({
      applicant_id: id,
      department: 'Design',
      hired_on,
      days_to_hire: 10,
    })
    const { builder, calls } = chain([[row('b', '2026-11-02'), row('a', '2026-10-01')]])
    supabaseMock.from.mockReturnValue(builder)

    const hires = await fetchHireHistory(new Date('2026-11-15T00:00:00Z'))

    expect(supabaseMock.from).toHaveBeenCalledWith('hire_history')
    expect(calls.gte).toEqual([['hired_on', '2024-01-01']])
    expect(calls.order?.[0]).toEqual(['hired_on', { ascending: false }])
    expect(hires.map((hire) => hire.applicantId)).toEqual(['a', 'b'])
  })

  it('pages hiring_monthly past one thousand rows', async () => {
    const monthRow = {
      month: '2026-01-01',
      department: 'Design',
      applicants_in: 1,
      hired: 0,
      rejected: 0,
    }
    const { builder, calls } = chain([
      Array.from({ length: PAGE_SIZE }, () => monthRow),
      [monthRow],
    ])
    supabaseMock.from.mockReturnValue(builder)

    const months = await fetchHiringMonthly()

    expect(months).toHaveLength(PAGE_SIZE + 1)
    expect(calls.range).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })
})
