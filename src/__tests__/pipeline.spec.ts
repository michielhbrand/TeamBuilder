import { describe, expect, it } from 'vitest'
import {
  candidateEntries,
  daysInStep,
  daysSince,
  daysSinceApplied,
  daysUntilDeadline,
  defaultApplicantStep,
  formatDeadline,
  groupBoards,
  isOverdue,
  longestInStepEntries,
  newestCandidateEntries,
  nextStep,
  parseDeadlineInput,
  previousStep,
  summariseBoard,
  summariseBoards,
  workDaysUntilDeadline,
} from '@/lib/pipeline'
import type { Board, Candidate } from '@/types/pipeline'

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    boardId: 'b1',
    name: 'Amara Okafor',
    email: 'amara.okafor@example.com',
    phone: '+1 555 010 2000',
    currentRole: 'Product Designer',
    favorite: false,
    stepId: 's1',
    status: 'active',
    appliedAt: '2026-11-01T00:00:00Z',
    stepEnteredAt: '2026-11-03T00:00:00Z',
    education: [],
    experience: [],
    ...overrides,
  }
}

function board(overrides: Partial<Board> = {}): Board {
  return {
    id: 'b1',
    name: 'Frontend Engineer',
    department: 'Engineering',
    openPositions: 1,
    deadline: '2026-11-30',
    steps: [
      { id: 's1', name: 'Applied', position: 0 },
      { id: 's2', name: 'Interview', position: 1 },
    ],
    candidates: [candidate()],
    ...overrides,
  }
}

describe('pipeline helpers', () => {
  it('calculates days since an ISO timestamp', () => {
    const now = new Date('2026-11-07T12:00:00Z')

    expect(daysSince('2026-11-07T08:00:00Z', now)).toBe(0)
    expect(daysSince('2026-11-05T12:00:00Z', now)).toBe(2)
    expect(daysSince('2026-11-10T12:00:00Z', now)).toBe(0)
  })

  it('derives time in step and time since application', () => {
    const now = new Date('2026-11-07T12:00:00Z')
    const item = candidate()

    expect(daysInStep(item, now)).toBe(4)
    expect(daysSinceApplied(item, now)).toBe(6)
  })

  it('flags boards whose deadline has passed', () => {
    const now = new Date('2026-11-07T12:00:00Z')

    expect(isOverdue(board({ deadline: '2026-11-30' }), now)).toBe(false)
    expect(isOverdue(board({ deadline: '2026-11-06' }), now)).toBe(true)
  })

  it('formats and parses deadlines as dd/mm/yyyy', () => {
    expect(formatDeadline('2026-11-07')).toBe('07/11/2026')
    expect(parseDeadlineInput('07/11/2026')).toBe('2026-11-07')
    expect(parseDeadlineInput('7/11/2026')).toBe('2026-11-07')
    expect(parseDeadlineInput('31/02/2026')).toBeUndefined()
    expect(parseDeadlineInput('2026-11-07')).toBeUndefined()
  })

  it('counts calendar and working days until a deadline', () => {
    const now = new Date('2026-11-07T12:00:00Z')

    expect(daysUntilDeadline('2026-11-13', now)).toBe(6)
    expect(workDaysUntilDeadline('2026-11-13', now)).toBe(5)
    expect(daysUntilDeadline('2026-11-06', now)).toBe(-1)
    expect(workDaysUntilDeadline('2026-11-06', now)).toBe(0)
  })

  it('defaults applicants to the Applied column', () => {
    const item = board({
      steps: [
        { id: 's1', name: 'Screening', position: 0 },
        { id: 's2', name: 'Applied', position: 1 },
      ],
    })

    expect(defaultApplicantStep(item)?.id).toBe('s2')
    expect(defaultApplicantStep(board())?.id).toBe('s1')
  })

  it('summarises active, closed, overdue, and per-step counts', () => {
    const item = board({
      deadline: '2026-11-06',
      candidates: [
        candidate({ id: 'a' }),
        candidate({ id: 'b', stepId: 's2' }),
        candidate({ id: 'c', status: 'hired', stepId: 's2' }),
        candidate({ id: 'd', status: 'rejected' }),
      ],
    })
    const summary = summariseBoard(item)

    expect(summary.active).toBe(2)
    expect(summary.overdue).toBe(true)
    expect(summary.hired).toBe(1)
    expect(summary.rejected).toBe(1)
    expect(summary.pipelineCounts).toEqual([1, 1])
  })

  it('finds adjacent steps and stops at the board edges', () => {
    const item = board()

    expect(nextStep(item, candidate())?.id).toBe('s2')
    expect(nextStep(item, candidate({ stepId: 's2' }))).toBeUndefined()
    expect(previousStep(item, candidate({ stepId: 's2' }))?.id).toBe('s1')
    expect(previousStep(item, candidate())).toBeUndefined()
  })

  it('flattens candidates with board, step, and elapsed-time context', () => {
    const now = new Date('2026-11-07T12:00:00Z')
    const item = board({
      candidates: [
        candidate({ id: 'a' }),
        candidate({
          id: 'b',
          status: 'hired',
          stepId: 's2',
          appliedAt: '2026-11-02T12:00:00Z',
          stepEnteredAt: '2026-11-06T12:00:00Z',
        }),
      ],
    })

    const active = candidateEntries([item], 'active', now)

    expect(active).toHaveLength(1)
    expect(active[0]?.board.id).toBe(item.id)
    expect(active[0]?.step?.name).toBe('Applied')
    expect(active[0]?.daysInStep).toBe(4)
    expect(active[0]?.daysSinceApplied).toBe(6)

    const all = candidateEntries([item], undefined, now)
    expect(all).toHaveLength(2)
    expect(all[1]?.step?.name).toBe('Interview')
  })

  it('orders newest applicants and longest step dwellers', () => {
    const now = new Date('2026-11-07T12:00:00Z')
    const item = board({
      candidates: [
        candidate({
          id: 'old',
          appliedAt: '2026-10-01T12:00:00Z',
          stepEnteredAt: '2026-11-07T12:00:00Z',
        }),
        candidate({
          id: 'new',
          appliedAt: '2026-11-06T12:00:00Z',
          stepEnteredAt: '2026-11-06T12:00:00Z',
        }),
        candidate({
          id: 'waiting',
          appliedAt: '2026-10-20T12:00:00Z',
          stepEnteredAt: '2026-10-21T12:00:00Z',
        }),
      ],
    })
    const entries = candidateEntries([item], undefined, now)

    expect(newestCandidateEntries(entries, 2).map((entry) => entry.candidate.id)).toEqual([
      'new',
      'waiting',
    ])
    expect(longestInStepEntries(entries, 2).map((entry) => entry.candidate.id)).toEqual([
      'waiting',
      'new',
    ])
  })

  it('groups boards in department order, sorts by name, and sums totals', () => {
    const boards = [
      board({ id: 'b1', name: 'Zeta', department: 'Engineering' }),
      board({ id: 'b2', name: 'Alpha', department: 'Engineering' }),
      board({ id: 'b3', name: 'Design lead', department: 'Design', deadline: '2026-11-01' }),
    ]
    const groups = groupBoards(boards)

    expect(groups[0]?.department).toBe('Engineering')
    expect(groups[0]?.boards.map((item) => item.name)).toEqual(['Alpha', 'Zeta'])

    const totals = summariseBoards(boards)
    expect(totals.openPositions).toBe(3)
    expect(totals.active).toBe(3)
    expect(totals.overdue).toBe(1)
  })
})
