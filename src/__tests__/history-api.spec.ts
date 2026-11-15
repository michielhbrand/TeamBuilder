import { describe, expect, it, vi } from 'vitest'
import { mapBoard } from '@/lib/api-shared'
import type { BoardRow } from '@/lib/api-shared'
import { mapHireRecord, mapHiringMonth } from '@/lib/history-api'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

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
