import { describe, expect, it } from 'vitest'
import {
  applicantActions,
  applicantsInStage,
  candidateEntries,
  daysInStep,
  daysSince,
  daysSinceApplied,
  daysUntilDeadline,
  deadlineLabel,
  defaultApplicantStep,
  formatDeadline,
  groupBoards,
  isOverdue,
  longestInStepEntries,
  newestCandidateEntries,
  nextStep,
  parseDeadlineInput,
  previousStep,
  reorderIds,
  sortBoards,
  stageBreakdown,
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

describe('deadlineLabel', () => {
  const now = new Date('2026-11-14T12:00:00Z')

  it('labels upcoming deadlines', () => {
    expect(deadlineLabel(board({ deadline: '2026-11-14' }), now)).toEqual({
      text: 'Due today',
      overdue: false,
    })
    expect(deadlineLabel(board({ deadline: '2026-11-15' }), now).text).toBe('Due tomorrow')
    expect(deadlineLabel(board({ deadline: '2026-11-26' }), now)).toEqual({
      text: 'Due in 12 days',
      overdue: false,
    })
  })

  it('labels overdue deadlines', () => {
    expect(deadlineLabel(board({ deadline: '2026-11-13' }), now)).toEqual({
      text: '1 day overdue',
      overdue: true,
    })
    expect(deadlineLabel(board({ deadline: '2026-11-10' }), now).text).toBe('4 days overdue')
  })

  it('handles an invalid deadline', () => {
    expect(deadlineLabel(board({ deadline: 'soon' }), now)).toEqual({
      text: 'No deadline',
      overdue: false,
    })
  })
})

describe('stageBreakdown', () => {
  const steps = ['A', 'B', 'C', 'D', 'E'].map((name, position) => ({
    id: `s${position + 1}`,
    name,
    position,
  }))

  it('limits stages and reports hidden ones', () => {
    const result = stageBreakdown(board({ steps, candidates: [] }), 3)
    expect(result.items).toHaveLength(3)
    expect(result.hidden).toBe(2)
  })

  it('counts only active applicants', () => {
    const result = stageBreakdown(
      board({
        candidates: [
          candidate({ id: 'a' }),
          candidate({ id: 'b', status: 'hired' }),
          candidate({ id: 'c', status: 'rejected' }),
        ],
      }),
    )
    expect(result.items).toEqual([
      { name: 'Applied', count: 1 },
      { name: 'Interview', count: 0 },
    ])
    expect(result.hidden).toBe(0)
  })

  it('has nothing hidden for a single stage', () => {
    const result = stageBreakdown(board({ steps: [steps[0]!], candidates: [] }))
    expect(result.hidden).toBe(0)
  })
})

describe('sortBoards', () => {
  const boards = [
    board({ id: '1', name: 'Zeta', deadline: '2026-12-01', candidates: [candidate()] }),
    board({ id: '2', name: 'Alpha', deadline: '2026-12-01', candidates: [] }),
    board({
      id: '3',
      name: 'Mid',
      deadline: '2026-11-01',
      candidates: [candidate({ id: 'x' }), candidate({ id: 'y' })],
    }),
  ]

  it('sorts by deadline ascending with name tie-break', () => {
    expect(sortBoards(boards, 'deadline').map((b) => b.id)).toEqual(['3', '2', '1'])
  })

  it('sorts by name', () => {
    expect(sortBoards(boards, 'name').map((b) => b.id)).toEqual(['2', '3', '1'])
  })

  it('sorts by active descending with name tie-break', () => {
    expect(sortBoards(boards, 'active').map((b) => b.id)).toEqual(['3', '1', '2'])
  })

  it('does not mutate the input', () => {
    const before = boards.map((b) => b.id)
    sortBoards(boards, 'name')
    expect(boards.map((b) => b.id)).toEqual(before)
  })
})

describe('applicantsInStage', () => {
  it('counts every status', () => {
    const target = board({
      candidates: [
        candidate({ id: 'a' }),
        candidate({ id: 'b', status: 'hired' }),
        candidate({ id: 'c', status: 'rejected' }),
        candidate({ id: 'd', stepId: 's2' }),
      ],
    })
    expect(applicantsInStage(target, 's1')).toBe(3)
    expect(applicantsInStage(target, 's2')).toBe(1)
  })
})

describe('reorderIds', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('moves an id', () => {
    expect(reorderIds(ids, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(reorderIds(ids, 1, 3)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('keeps index 0 locked', () => {
    expect(reorderIds(ids, 0, 2)).toEqual(ids)
    expect(reorderIds(ids, 2, 0)).toEqual(ids)
  })

  it('ignores out-of-range and no-op moves', () => {
    expect(reorderIds(ids, 1, 9)).toEqual(ids)
    expect(reorderIds(ids, 9, 1)).toEqual(ids)
    expect(reorderIds(ids, 2, 2)).toEqual(ids)
    expect(reorderIds(['a'], 0, 0)).toEqual(['a'])
  })

  it('returns a copy', () => {
    expect(reorderIds(ids, 0, 0)).not.toBe(ids)
  })
})

describe('applicantActions', () => {
  const steps = [
    { id: 's1', name: 'Applied', position: 0 },
    { id: 's2', name: 'Interview', position: 1 },
    { id: 's3', name: 'Offer', position: 2 },
  ]
  const target = board({ steps })

  it('has no previous stage in the first stage', () => {
    const result = applicantActions(target, candidate({ stepId: 's1' }))
    expect(result.previous).toBeUndefined()
    expect(result.next?.id).toBe('s2')
    expect(result).toMatchObject({ canHire: true, canReject: true, canReopen: false })
  })

  it('has no next stage in the last stage', () => {
    const result = applicantActions(target, candidate({ stepId: 's3' }))
    expect(result.next).toBeUndefined()
    expect(result.previous?.id).toBe('s2')
  })

  it('only allows reopening closed applicants', () => {
    for (const status of ['hired', 'rejected'] as const) {
      expect(applicantActions(target, candidate({ stepId: 's2', status }))).toEqual({
        next: undefined,
        previous: undefined,
        canHire: false,
        canReject: false,
        canReopen: true,
      })
    }
  })

  it('has no moves on a single-stage board', () => {
    const result = applicantActions(board({ steps: [steps[0]!] }), candidate())
    expect(result.next).toBeUndefined()
    expect(result.previous).toBeUndefined()
  })
})
