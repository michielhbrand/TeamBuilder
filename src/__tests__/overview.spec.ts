import { describe, expect, it } from 'vitest'
import {
  attentionItems,
  filledShare,
  finalStageCount,
  formatCount,
  hireRate,
  hiresInQuarters,
  median,
  medianByQuarter,
  openedDaysAgo,
  percentile,
  quarterKey,
  quarterLabel,
  quarterSeries,
  rangeByDepartment,
  recentQuarters,
  roleFlow,
  slowestStage,
  speedCurve,
  stageStats,
} from '@/lib/overview'
import type { HireRecord, HiringMonth } from '@/types/history'
import type { Board, Candidate } from '@/types/pipeline'

const now = new Date('2026-11-15T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

function dayOffset(days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

function applicant(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id,
    boardId: 'b1',
    name: `Applicant ${id}`,
    email: '',
    phone: '',
    currentRole: '',
    remChannel: '',
    salaryBand: '',
    noticePeriodMonths: 0,
    salaryExpectationCents: 0,
    favorite: false,
    stepId: 's1',
    status: 'active',
    appliedAt: daysAgo(20),
    stepEnteredAt: daysAgo(3),
    education: [],
    experience: [],
    skills: [],
    ...overrides,
  }
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'b1',
    name: 'Product Designer',
    department: 'Design',
    openPositions: 2,
    deadline: dayOffset(30),
    openedAt: daysAgo(30),
    steps: [
      { id: 's1', name: 'Applied', position: 0 },
      { id: 's2', name: 'Interview', position: 1 },
      { id: 's3', name: 'Offer', position: 2 },
    ],
    candidates: [],
    ...overrides,
  }
}

function month(
  value: string,
  department: string,
  applicantsIn: number,
  hired: number,
  rejected: number,
): HiringMonth {
  return { month: value, department, applicantsIn, hired, rejected }
}

function hire(id: string, department: string, hiredOn: string, daysToHire: number): HireRecord {
  return { applicantId: id, department, hiredOn, daysToHire }
}

describe('formatCount', () => {
  it('groups thousands only from 1000', () => {
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1000)).toBe('1,000')
    expect(formatCount(1234567)).toBe('1,234,567')
    expect(formatCount(0)).toBe('0')
  })
})

describe('percentile and median', () => {
  it('interpolates linearly', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25)
    expect(percentile([40, 10, 30, 20], 0.25)).toBe(17.5)
    expect(percentile([7], 0.9)).toBe(7)
    expect(percentile([10, 20], 0)).toBe(10)
    expect(percentile([10, 20], 1)).toBe(20)
  })

  it('returns null for empty input', () => {
    expect(percentile([], 0.5)).toBeNull()
    expect(median([])).toBeNull()
  })

  it('computes the median', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('quarters', () => {
  it('keys and labels calendar quarters', () => {
    expect(quarterKey('2026-11-15')).toBe('2026-Q4')
    expect(quarterKey('2026-01-01')).toBe('2026-Q1')
    expect(quarterKey('2026-06-30')).toBe('2026-Q2')
    expect(quarterKey('2026-07-01')).toBe('2026-Q3')
    expect(quarterLabel('2026-Q4')).toBe('Q4 26')
    expect(quarterLabel('2031-Q1')).toBe('Q1 31')
  })

  it('lists recent quarters oldest first across a year boundary', () => {
    expect(recentQuarters(now, 4)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'])
    expect(recentQuarters(new Date('2026-02-10T00:00:00Z'), 4)).toEqual([
      '2025-Q2',
      '2025-Q3',
      '2025-Q4',
      '2026-Q1',
    ])
    expect(recentQuarters(now, 1)).toEqual(['2026-Q4'])
  })
})

describe('quarterSeries', () => {
  const months = [
    month('2026-01-01', 'Design', 4, 1, 0),
    month('2026-02-01', 'Design', 6, 0, 2),
    month('2026-02-01', 'Engineering', 10, 2, 1),
    month('2026-10-01', 'Design', 3, 1, 1),
    month('2026-11-01', 'Engineering', 5, 0, 0),
  ]

  it('sums months into quarters and marks only the current one partial', () => {
    const series = quarterSeries(months, 'all', 4, now)

    expect(series.map((point) => point.key)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'])
    expect(series[0]).toEqual({
      key: '2026-Q1',
      label: 'Q1 26',
      partial: false,
      applicantsIn: 20,
      hired: 3,
      rejected: 3,
    })
    expect(series[1]).toMatchObject({ applicantsIn: 0, hired: 0, rejected: 0 })
    expect(series[3]).toMatchObject({ partial: true, applicantsIn: 8, hired: 1, rejected: 1 })
    expect(series.filter((point) => point.partial)).toHaveLength(1)
  })

  it('filters by department', () => {
    const series = quarterSeries(months, 'Design', 4, now)

    expect(series[0]).toMatchObject({ applicantsIn: 10, hired: 1, rejected: 2 })
    expect(series[3]).toMatchObject({ applicantsIn: 3, hired: 1, rejected: 1 })
  })

  it('trims to the earliest recorded quarter', () => {
    const series = quarterSeries(
      [month('2026-07-01', 'Design', 2, 1, 0), month('2026-11-01', 'Design', 1, 0, 0)],
      'all',
      4,
      now,
    )

    expect(series.map((point) => point.key)).toEqual(['2026-Q3', '2026-Q4'])
  })

  it('always keeps at least the current quarter', () => {
    expect(quarterSeries([], 'all', 4, now).map((point) => point.key)).toEqual(['2026-Q4'])
    expect(
      quarterSeries([month('2025-01-01', 'Design', 1, 0, 0)], 'all', 1, now).map(
        (point) => point.key,
      ),
    ).toEqual(['2026-Q4'])
  })
})

describe('hireRate', () => {
  it('is null when nothing has been decided', () => {
    expect(hireRate([], 'all')).toEqual({ hired: 0, rejected: 0, percent: null })
    expect(hireRate([month('2026-10-01', 'Design', 5, 0, 0)], 'all').percent).toBeNull()
  })

  it('rounds hired over decided', () => {
    expect(hireRate([month('2026-10-01', 'Design', 5, 3, 1)], 'all')).toEqual({
      hired: 3,
      rejected: 1,
      percent: 75,
    })
    expect(hireRate([month('2026-10-01', 'Design', 5, 1, 2)], 'all').percent).toBe(33)
  })

  it('filters by department', () => {
    const months = [month('2026-10-01', 'Design', 5, 3, 1), month('2026-10-01', 'Sales', 5, 0, 4)]

    expect(hireRate(months, 'Sales')).toEqual({ hired: 0, rejected: 4, percent: 0 })
    expect(hireRate(months, 'all').percent).toBe(38)
  })
})

describe('hires', () => {
  const hires = [
    hire('a', 'Design', '2026-02-10', 30),
    hire('b', 'Design', '2026-10-20', 50),
    hire('c', 'Sales', '2026-11-02', 70),
    hire('d', 'Sales', '2025-05-02', 90),
  ]

  it('filters hires by department and quarter keys', () => {
    expect(hiresInQuarters(hires, 'all', ['2026-Q4']).map((h) => h.applicantId)).toEqual(['b', 'c'])
    expect(
      hiresInQuarters(hires, 'Sales', ['2026-Q4', '2025-Q2']).map((h) => h.applicantId),
    ).toEqual(['c', 'd'])
    expect(hiresInQuarters(hires, 'Design', [])).toEqual([])
  })

  it('computes quartiles per department in order of first appearance', () => {
    const ranges = rangeByDepartment([
      hire('1', 'Sales', '2026-01-01', 10),
      hire('2', 'Design', '2026-01-01', 5),
      hire('3', 'Sales', '2026-01-01', 20),
      hire('4', 'Sales', '2026-01-01', 30),
      hire('5', 'Sales', '2026-01-01', 40),
    ])

    expect(ranges.map((range) => range.department)).toEqual(['Sales', 'Design'])
    expect(ranges[0]).toEqual({
      department: 'Sales',
      count: 4,
      min: 10,
      q1: 17.5,
      median: 25,
      q3: 32.5,
      max: 40,
    })
    expect(ranges[1]).toEqual({
      department: 'Design',
      count: 1,
      min: 5,
      q1: 5,
      median: 5,
      q3: 5,
      max: 5,
    })
    expect(rangeByDepartment([])).toEqual([])
  })

  it('builds a cumulative speed curve that ends at 1', () => {
    const curve = speedCurve([
      hire('1', 'Sales', '2026-01-01', 40),
      hire('2', 'Sales', '2026-01-01', 10),
      hire('3', 'Sales', '2026-01-01', 20),
      hire('4', 'Sales', '2026-01-01', 30),
    ])

    expect(curve).toEqual([
      { days: 10, share: 0.25 },
      { days: 20, share: 0.5 },
      { days: 30, share: 0.75 },
      { days: 40, share: 1 },
    ])
    expect(speedCurve([])).toEqual([])
  })

  it('computes the median per quarter and null for empty quarters', () => {
    expect(medianByQuarter(hires, ['2025-Q4', '2026-Q1', '2026-Q4'])).toEqual([
      { key: '2025-Q4', median: null },
      { key: '2026-Q1', median: 30 },
      { key: '2026-Q4', median: 60 },
    ])
  })
})

describe('attentionItems', () => {
  it('orders overdue, final stage, stalled, then due soon', () => {
    const dueSoon = makeBoard({ id: 'due', name: 'Due soon role', deadline: dayOffset(10) })
    const stalled = makeBoard({
      id: 'stalled',
      name: 'Stalled role',
      deadline: dayOffset(40),
      candidates: [applicant('a1', { boardId: 'stalled' })],
    })
    const final = makeBoard({
      id: 'final',
      name: 'Final role',
      deadline: dayOffset(40),
      candidates: [
        applicant('f1', { boardId: 'final', stepId: 's3' }),
        applicant('f2', { boardId: 'final', stepId: 's2' }),
      ],
    })
    const lateLess = makeBoard({ id: 'late2', name: 'Late 2', deadline: dayOffset(-2) })
    const lateMore = makeBoard({ id: 'late9', name: 'Late 9', deadline: dayOffset(-9) })

    const items = attentionItems([dueSoon, stalled, final, lateLess, lateMore], now)

    expect(items.map((item) => [item.kind, item.boardId])).toEqual([
      ['overdue', 'late9'],
      ['overdue', 'late2'],
      ['final', 'final'],
      ['stalled', 'stalled'],
      ['due-soon', 'due'],
    ])
  })

  it('sorts due-soon items soonest first and final-stage items by applicants then name', () => {
    const due = (id: string, days: number) =>
      makeBoard({ id, name: id, deadline: dayOffset(days), candidates: [] })
    const atFinal = (id: string, name: string, count: number) =>
      makeBoard({
        id,
        name,
        deadline: dayOffset(60),
        candidates: Array.from({ length: count }, (_, index) =>
          applicant(`${id}${index}`, { boardId: id, stepId: 's3' }),
        ),
      })

    const items = attentionItems(
      [
        due('d12', 12),
        due('d2', 2),
        due('d7', 7),
        atFinal('f1', 'Zed', 1),
        atFinal('f3', 'Mid', 3),
        atFinal('f2', 'Abe', 1),
      ],
      now,
    )

    expect(items.filter((item) => item.kind === 'due-soon').map((item) => item.boardId)).toEqual([
      'd2',
      'd7',
      'd12',
    ])
    expect(items.filter((item) => item.kind === 'final').map((item) => item.boardId)).toEqual([
      'f3',
      'f2',
      'f1',
    ])
  })

  it('writes the copy for each kind', () => {
    const overdue = makeBoard({
      id: 'o',
      name: 'Overdue role',
      deadline: dayOffset(-5),
      openPositions: 3,
      candidates: [
        applicant('a', { stepId: 's2' }),
        applicant('b', { stepId: 's2' }),
        applicant('c', { status: 'hired' }),
      ],
    })
    const final = makeBoard({
      id: 'f',
      name: 'Final role',
      deadline: dayOffset(60),
      candidates: [
        applicant('a', { stepId: 's3', stepEnteredAt: daysAgo(4) }),
        applicant('b', { stepId: 's3', stepEnteredAt: daysAgo(6) }),
        applicant('c', { stepId: 's2' }),
      ],
    })
    const stalled = makeBoard({
      id: 's',
      name: 'Stalled role',
      deadline: dayOffset(20),
      candidates: [applicant('a'), applicant('b')],
    })
    const dueSoon = makeBoard({
      id: 'd',
      name: 'Due role',
      deadline: dayOffset(1),
      openPositions: 1,
    })

    const byKind = Object.fromEntries(
      attentionItems([overdue, final, stalled, dueSoon], now).map((item) => [item.kind, item]),
    )

    expect(byKind.overdue).toMatchObject({
      title: 'Overdue role is 5 days past its deadline',
      detail: '2 active applicants · 1 of 3 positions filled',
    })
    expect(byKind.final).toMatchObject({
      title: '2 applicants are at the final stage (Offer) for Final role',
      detail: 'Median 5 days at this stage',
    })
    expect(byKind.stalled).toMatchObject({
      title: 'Nobody has left the first stage for Stalled role',
      detail: '2 applicants, all in Applied · due in 20 days',
    })
    expect(byKind['due-soon']).toMatchObject({
      title: 'Due role is due tomorrow',
      detail: '1 open position · 0 filled',
    })
  })

  it('uses singular wording', () => {
    const board = makeBoard({
      deadline: dayOffset(60),
      candidates: [applicant('a', { stepId: 's3' })],
    })

    expect(attentionItems([board], now)[0]?.title).toBe(
      '1 applicant is at the final stage (Offer) for Product Designer',
    )
  })

  it('uses singular days in the attention copy', () => {
    const late = makeBoard({ deadline: dayOffset(-1), candidates: [] })
    const final = makeBoard({
      id: 'f',
      name: 'Final role',
      deadline: dayOffset(60),
      candidates: [applicant('a', { stepId: 's3', stepEnteredAt: daysAgo(1) })],
    })
    const stalled = makeBoard({
      id: 's',
      name: 'Stalled role',
      deadline: dayOffset(1),
      candidates: [applicant('a')],
    })

    expect(attentionItems([late], now)[0]?.title).toBe(
      'Product Designer is 1 day past its deadline',
    )
    expect(attentionItems([final], now)[0]?.detail).toBe('Median 1 day at this stage')
    expect(attentionItems([stalled], now).find((item) => item.kind === 'stalled')?.detail).toBe(
      '1 applicant, all in Applied · due tomorrow',
    )
  })

  it('yields several kinds for one board', () => {
    const board = makeBoard({
      deadline: dayOffset(-1),
      candidates: [applicant('a', { stepId: 's3' })],
    })

    expect(attentionItems([board], now).map((item) => item.kind)).toEqual(['overdue', 'final'])
  })

  it('never yields final or stalled without active applicants', () => {
    const board = makeBoard({
      deadline: dayOffset(60),
      candidates: [
        applicant('a', { status: 'hired', stepId: 's3' }),
        applicant('b', { status: 'rejected' }),
      ],
    })

    expect(attentionItems([board], now)).toEqual([])
  })

  it('only flags stalled boards that are at least 7 days old', () => {
    const young = makeBoard({
      deadline: dayOffset(60),
      openedAt: daysAgo(6),
      candidates: [applicant('a')],
    })
    const old = makeBoard({
      deadline: dayOffset(60),
      openedAt: daysAgo(7),
      candidates: [applicant('a')],
    })

    expect(attentionItems([young], now)).toEqual([])
    expect(attentionItems([old], now).map((item) => item.kind)).toEqual(['stalled'])
  })

  it('does not flag stalled when someone has left the first stage', () => {
    const board = makeBoard({
      deadline: dayOffset(60),
      candidates: [applicant('a'), applicant('b', { stepId: 's2' })],
    })

    expect(attentionItems([board], now)).toEqual([])
  })

  it('does not flag stalled on a single-stage board', () => {
    const board = makeBoard({
      deadline: dayOffset(60),
      steps: [{ id: 's1', name: 'Applied', position: 0 }],
      candidates: [applicant('a')],
    })

    expect(attentionItems([board], now).map((item) => item.kind)).toEqual(['final'])
  })

  it('treats the due-soon window as 0 to 14 days', () => {
    const today = makeBoard({ id: 't', deadline: dayOffset(0) })
    const edge = makeBoard({ id: 'e', deadline: dayOffset(14) })
    const outside = makeBoard({ id: 'x', deadline: dayOffset(15) })

    expect(attentionItems([today, edge, outside], now).map((item) => item.boardId)).toEqual([
      't',
      'e',
    ])
  })

  it('returns every item without slicing', () => {
    const boards = Array.from({ length: 9 }, (_, index) =>
      makeBoard({ id: `b${index}`, deadline: dayOffset(-index - 1) }),
    )

    expect(attentionItems(boards, now)).toHaveLength(9)
  })
})

describe('board metrics', () => {
  const board = makeBoard({
    openPositions: 2,
    candidates: [
      applicant('a', { stepId: 's1', stepEnteredAt: daysAgo(2) }),
      applicant('b', { stepId: 's1', stepEnteredAt: daysAgo(6) }),
      applicant('c', { stepId: 's3', stepEnteredAt: daysAgo(9) }),
      applicant('d', { status: 'hired', stepId: 's3' }),
      applicant('e', { status: 'rejected', stepId: 's2', stepEnteredAt: daysAgo(40) }),
    ],
  })

  it('counts active applicants at the final stage', () => {
    expect(finalStageCount(board)).toBe(1)
    expect(finalStageCount(makeBoard())).toBe(0)
    expect(finalStageCount(makeBoard({ steps: [], candidates: [applicant('a')] }))).toBe(0)
  })

  it('computes per-stage counts and medians of active applicants', () => {
    expect(stageStats(board, now)).toEqual([
      { stepId: 's1', name: 'Applied', count: 2, medianDays: 4 },
      { stepId: 's2', name: 'Interview', count: 0, medianDays: null },
      { stepId: 's3', name: 'Offer', count: 1, medianDays: 9 },
    ])
  })

  it('handles a single-stage board', () => {
    const single = makeBoard({
      steps: [{ id: 's1', name: 'Applied', position: 0 }],
      candidates: [applicant('a', { stepEnteredAt: daysAgo(5) })],
    })

    expect(stageStats(single, now)).toEqual([
      { stepId: 's1', name: 'Applied', count: 1, medianDays: 5 },
    ])
  })

  it('picks the slowest stage', () => {
    expect(slowestStage(stageStats(board, now))).toMatchObject({ stepId: 's3', medianDays: 9 })
    expect(slowestStage(stageStats(makeBoard(), now))).toBeUndefined()
    expect(slowestStage([])).toBeUndefined()
  })

  it('summarizes the role flow', () => {
    expect(roleFlow(board)).toEqual({
      boardId: 'b1',
      name: 'Product Designer',
      total: 5,
      hired: 1,
      rejected: 1,
      active: 3,
    })
  })

  it('caps the filled share at 1 and handles zero positions', () => {
    expect(filledShare(board)).toEqual({ hired: 1, open: 2, share: 0.5 })

    const over = makeBoard({
      openPositions: 1,
      candidates: [applicant('a', { status: 'hired' }), applicant('b', { status: 'hired' })],
    })

    expect(filledShare(over)).toEqual({ hired: 2, open: 1, share: 1 })
    expect(filledShare(makeBoard({ openPositions: 0 }))).toEqual({ hired: 0, open: 0, share: 0 })
  })

  it('counts days since the board opened', () => {
    expect(openedDaysAgo(makeBoard({ openedAt: daysAgo(12) }), now)).toBe(12)
  })
})
