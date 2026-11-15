import { describe, expect, it } from 'vitest'
import {
  buildWorkbookModel,
  columnWidth,
  exportFileName,
  type ExportValue,
  type SheetModel,
} from '@/lib/export-sheets'
import type { HireRecord, HiringMonth } from '@/types/history'
import type { Board, Candidate } from '@/types/pipeline'

const now = new Date('2026-11-15T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

function dayOffset(days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function applicant(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id,
    boardId: 'b1',
    name: `Applicant ${id}`,
    email: '',
    phone: '',
    currentRole: '',
    noticePeriodMonths: 0,
    salaryExpectationCents: 0,
    favorite: false,
    stepId: 's1',
    status: 'active',
    appliedAt: daysAgo(20),
    stepEnteredAt: daysAgo(3),
    education: [],
    experience: [],
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

const designer = makeBoard({
  id: 'b1',
  name: 'Product Designer',
  department: 'Design',
  openPositions: 2,
  deadline: dayOffset(-5),
  candidates: [
    applicant('zed', {
      boardId: 'b1',
      name: 'Zed',
      stepId: 's2',
      email: 'zed@example.com',
      phone: '0821234567',
      currentRole: 'Developer',
      salaryExpectationCents: 1_500_000,
      noticePeriodMonths: 2,
      favorite: true,
      appliedAt: daysAgo(40),
      stepEnteredAt: daysAgo(3),
    }),
    applicant('amy', { boardId: 'b1', name: 'Amy', stepId: 's1', stepEnteredAt: daysAgo(7) }),
    applicant('bob', { boardId: 'b1', name: 'Bob', stepId: 's2' }),
    applicant('cat', { boardId: 'b1', name: 'Cat', stepId: 's3' }),
    applicant('hal', { boardId: 'b1', name: 'Hal', stepId: 's3', status: 'hired' }),
    applicant('rex', { boardId: 'b1', name: 'Rex', stepId: 's1', status: 'rejected' }),
  ],
})

const engineer = makeBoard({
  id: 'b2',
  name: 'Backend Engineer',
  department: 'Engineering',
  openPositions: 0,
  deadline: dayOffset(10),
  steps: [
    { id: 't1', name: 'Applied', position: 0 },
    { id: 't2', name: 'Offer', position: 1 },
  ],
  candidates: [applicant('dan', { boardId: 'b2', name: 'Dan', stepId: 't1' })],
})

const support = makeBoard({
  id: 'b3',
  name: 'Support Lead',
  department: 'Customer success',
  openPositions: 1,
  deadline: dayOffset(30),
  steps: [{ id: 'u1', name: 'Applied', position: 0 }],
  candidates: [],
})

const months: HiringMonth[] = [
  month('2025-06-01', 'Design', 4, 3, 1),
  month('2026-03-01', 'Design', 5, 1, 2),
  month('2026-04-01', 'Design', 3, 0, 0),
  month('2026-10-01', 'Design', 4, 1, 1),
  month('2026-10-01', 'Engineering', 2, 0, 0),
  month('2026-11-01', 'Engineering', 6, 2, 0),
]

const hires: HireRecord[] = [
  hire('h1', 'Design', '2026-03-10', 30),
  hire('h2', 'Design', '2026-10-05', 20),
  hire('h3', 'Design', '2026-11-02', 40),
  hire('h4', 'Engineering', '2026-11-03', 10),
  hire('h5', 'Engineering', '2026-10-20', 50),
  hire('h6', 'Engineering', '2025-01-05', 100),
]

function build(
  department: string | 'all' = 'all',
  overrides: Partial<{
    boards: Board[]
    months: HiringMonth[]
    hires: HireRecord[]
  }> = {},
): SheetModel[] {
  return buildWorkbookModel({
    boards: [support, designer, engineer],
    months,
    hires,
    department,
    now,
    ...overrides,
  })
}

function sheet(models: SheetModel[], name: string): SheetModel {
  const found = models.find((model) => model.name === name)
  if (!found) {
    throw new Error(`Missing sheet ${name}`)
  }
  return found
}

function column(model: SheetModel, header: string): ExportValue[] {
  const index = model.columns.findIndex((entry) => entry.header === header)
  if (index === -1) {
    throw new Error(`Missing column ${header}`)
  }
  return model.rows.map((row) => row[index] ?? null)
}

describe('buildWorkbookModel', () => {
  it('returns the six sheets in order with the right layout', () => {
    const models = build()

    expect(models.map((model) => model.name)).toEqual([
      'Summary',
      'Active roles',
      'Applicants',
      'Pipeline',
      'Hiring by quarter',
      'Time to hire',
    ])
    expect(models.map((model) => model.layout)).toEqual([
      'summary',
      'table',
      'table',
      'table',
      'table',
      'table',
    ])
    expect(models.map((model) => model.landscape)).toEqual([false, true, true, false, false, false])
  })

  it('builds the Active roles rows sorted by deadline', () => {
    const roles = sheet(build(), 'Active roles')

    expect(roles.columns.map((entry) => entry.header)).toEqual([
      'Role',
      'Department',
      'Open positions',
      'Filled',
      'Deadline',
      'Days to deadline',
      'Opened',
      'Stages',
      'Active',
      'Hired',
      'Rejected',
      'At final stage',
    ])
    expect(roles.columns.map((entry) => entry.kind)).toEqual([
      'text',
      'text',
      'integer',
      'integer',
      'date',
      'days',
      'date',
      'integer',
      'integer',
      'integer',
      'integer',
      'integer',
    ])
    expect(roles.rows).toEqual([
      [
        'Product Designer',
        'Design',
        2,
        1,
        utcDate(dayOffset(-5)),
        -5,
        utcDate('2026-10-16'),
        3,
        4,
        1,
        1,
        1,
      ],
      [
        'Backend Engineer',
        'Engineering',
        0,
        0,
        utcDate(dayOffset(10)),
        10,
        utcDate('2026-10-16'),
        2,
        1,
        0,
        0,
        0,
      ],
      [
        'Support Lead',
        'Customer success',
        1,
        0,
        utcDate(dayOffset(30)),
        30,
        utcDate('2026-10-16'),
        1,
        0,
        0,
        0,
        0,
      ],
    ])
  })

  it('lists applicants by role, stage position and name with typed values', () => {
    const applicants = sheet(build(), 'Applicants')

    expect(applicants.columns.map((entry) => entry.header)).toEqual([
      'Role',
      'Department',
      'Stage',
      'Status',
      'Applicant',
      'Email',
      'Phone',
      'Current role',
      'Applied',
      'Days in stage',
      'Notice period (months)',
      'Salary expectation (rand)',
      'Favorite',
    ])
    expect(column(applicants, 'Applicant')).toEqual([
      'Dan',
      'Amy',
      'Rex',
      'Bob',
      'Zed',
      'Cat',
      'Hal',
    ])
    expect(column(applicants, 'Role')).toEqual([
      'Backend Engineer',
      'Product Designer',
      'Product Designer',
      'Product Designer',
      'Product Designer',
      'Product Designer',
      'Product Designer',
    ])
    expect(column(applicants, 'Status')).toEqual([
      'Active',
      'Active',
      'Rejected',
      'Active',
      'Active',
      'Active',
      'Hired',
    ])
    expect(column(applicants, 'Stage')).toEqual([
      'Applied',
      'Applied',
      'Applied',
      'Interview',
      'Interview',
      'Offer',
      'Offer',
    ])

    const zed = applicants.rows[4] as ExportValue[]
    expect(zed).toEqual([
      'Product Designer',
      'Design',
      'Interview',
      'Active',
      'Zed',
      'zed@example.com',
      '0821234567',
      'Developer',
      utcDate('2026-10-06'),
      3,
      2,
      15000,
      'Yes',
    ])
  })

  it('leaves optional applicant values empty and keeps a zero notice period', () => {
    const applicants = sheet(build(), 'Applicants')
    const dan = applicants.rows[0] as ExportValue[]

    expect(dan[5]).toBeNull()
    expect(dan[6]).toBeNull()
    expect(dan[7]).toBeNull()
    expect(dan[10]).toBe(0)
    expect(dan[11]).toBeNull()
    expect(dan[12]).toBeNull()
    expect(column(applicants, 'Days in stage')).toEqual([3, 7, null, 3, 3, 3, null])
  })

  it('keeps fractional notice periods and uses a decimal column kind', () => {
    const half = makeBoard({
      id: 'b9',
      name: 'Half',
      candidates: [
        applicant('a', { boardId: 'b9', name: 'A', noticePeriodMonths: 1.5 }),
        applicant('b', { boardId: 'b9', name: 'B', noticePeriodMonths: 0 }),
        applicant('c', { boardId: 'b9', name: 'C', noticePeriodMonths: 3 }),
      ],
    })
    const applicants = sheet(build('all', { boards: [half] }), 'Applicants')

    expect(
      applicants.columns.find((entry) => entry.header === 'Notice period (months)')?.kind,
    ).toBe('decimal')
    expect(column(applicants, 'Notice period (months)')).toEqual([1.5, 0, 3])
  })

  it('orders departments by the known order, then alphabetically, in the history sheets', () => {
    const models = build('all', {
      months: [
        month('2026-10-01', 'Zoology', 1, 0, 0),
        month('2026-10-01', 'Design', 1, 0, 0),
        month('2026-10-01', 'Aviation', 1, 0, 0),
        month('2026-10-01', 'Engineering', 1, 0, 0),
      ],
      hires: [
        hire('a', 'Zoology', '2026-10-05', 5),
        hire('b', 'Design', '2026-10-05', 5),
        hire('c', 'Aviation', '2026-10-05', 5),
        hire('d', 'Engineering', '2026-10-05', 5),
      ],
    })
    const order = ['Engineering', 'Design', 'Aviation', 'Zoology', 'All departments']

    expect(column(sheet(models, 'Hiring by quarter'), 'Department')).toEqual(order)
    expect(column(sheet(models, 'Time to hire'), 'Department')).toEqual(order)
  })

  it('leaves the summary hire rate empty when nobody is decided', () => {
    const summary = sheet(
      build('all', { months: [month('2026-10-01', 'Design', 3, 0, 0)] }),
      'Summary',
    )

    expect(summary.rows[8]).toEqual(['Hire rate', null, null, null, null, null])
  })

  it('lists every stage in order with active counts only', () => {
    const pipeline = sheet(build(), 'Pipeline')

    expect(pipeline.columns.map((entry) => entry.header)).toEqual([
      'Role',
      'Department',
      'Stage number',
      'Stage',
      'Active applicants',
    ])
    expect(pipeline.rows).toEqual([
      ['Backend Engineer', 'Engineering', 1, 'Applied', 1],
      ['Backend Engineer', 'Engineering', 2, 'Offer', 0],
      ['Product Designer', 'Design', 1, 'Applied', 1],
      ['Product Designer', 'Design', 2, 'Interview', 2],
      ['Product Designer', 'Design', 3, 'Offer', 1],
      ['Support Lead', 'Customer success', 1, 'Applied', 0],
    ])
  })

  it('sums hiring months per quarter and department with an all row for the all scope', () => {
    const quarters = sheet(build(), 'Hiring by quarter')

    expect(quarters.columns.map((entry) => entry.header)).toEqual([
      'Quarter',
      'Department',
      'Applicants in',
      'Hired',
      'Rejected',
      'Hire rate',
    ])
    expect(quarters.columns[5]?.kind).toBe('percent')
    expect(quarters.rows).toEqual([
      ['2025 Q2', 'Design', 4, 3, 1, 0.75],
      ['2025 Q2', 'All departments', 4, 3, 1, 0.75],
      ['2026 Q1', 'Design', 5, 1, 2, 1 / 3],
      ['2026 Q1', 'All departments', 5, 1, 2, 1 / 3],
      ['2026 Q2', 'Design', 3, 0, 0, null],
      ['2026 Q2', 'All departments', 3, 0, 0, null],
      ['2026 Q4', 'Engineering', 8, 2, 0, 1],
      ['2026 Q4', 'Design', 4, 1, 1, 0.5],
      ['2026 Q4', 'All departments', 12, 3, 1, 0.75],
    ])
  })

  it('omits the all row for a single department', () => {
    const quarters = sheet(build('Engineering'), 'Hiring by quarter')

    expect(quarters.rows).toEqual([['2026 Q4', 'Engineering', 8, 2, 0, 1]])
  })

  it('summarises time to hire per department with the last four quarters median', () => {
    const times = sheet(build(), 'Time to hire')

    expect(times.columns.map((entry) => entry.header)).toEqual([
      'Department',
      'Hires (last 12 quarters)',
      'Median days',
      'Fastest',
      'Slowest',
      'Quartile 1',
      'Quartile 3',
      'Median (last 4 quarters)',
    ])
    expect(times.rows).toEqual([
      ['Engineering', 3, 50, 10, 100, 30, 75, 30],
      ['Design', 3, 30, 20, 40, 25, 35, 30],
      ['All departments', 6, 35, 10, 100, 23, 48, 30],
    ])
  })

  it('gives null last four quarter median when a department has no recent hires', () => {
    const times = sheet(
      build('all', { hires: [hire('old', 'Design', '2024-02-01', 12)] }),
      'Time to hire',
    )

    expect(times.rows).toEqual([
      ['Design', 1, 12, 12, 12, 12, 12, null],
      ['All departments', 1, 12, 12, 12, 12, 12, null],
    ])
  })

  it('returns null instead of NaN when there are no hires', () => {
    const times = sheet(build('all', { hires: [] }), 'Time to hire')

    expect(times.rows).toEqual([['All departments', 0, null, null, null, null, null, null]])
  })

  it('filters every sheet and the history by department', () => {
    const models = build('Design')

    expect(sheet(models, 'Active roles').rows.map((row) => row[0])).toEqual(['Product Designer'])
    expect(new Set(column(sheet(models, 'Applicants'), 'Department'))).toEqual(new Set(['Design']))
    expect(new Set(column(sheet(models, 'Pipeline'), 'Department'))).toEqual(new Set(['Design']))
    expect(new Set(column(sheet(models, 'Hiring by quarter'), 'Department'))).toEqual(
      new Set(['Design']),
    )
    expect(sheet(models, 'Time to hire').rows).toEqual([['Design', 3, 30, 20, 40, 25, 35, 30]])
  })

  it('leaves the live sheets with only headers when there are no boards', () => {
    const models = build('all', { boards: [] })

    expect(sheet(models, 'Active roles').rows).toEqual([])
    expect(sheet(models, 'Applicants').rows).toEqual([])
    expect(sheet(models, 'Pipeline').rows).toEqual([])
    expect(sheet(models, 'Hiring by quarter').rows.map((row) => row[0])).toContain('2025 Q2')

    const summary = sheet(models, 'Summary')

    expect(summary.rows.slice(3, 6)).toEqual([
      ['Open positions', 0, null, null, null, null],
      ['Active applicants', 0, null, null, null, null],
      ['At final stage', 0, null, null, null, null],
    ])
    expect(summary.rows[6]?.[1]).toBe(4)
    expect(summary.rows[10]?.[0]).toBe('By department')
    expect(summary.rows).toHaveLength(12)
    expect(String(summary.rows[11]?.[0])).toMatch(/^Hiring history starts on June 2025/)
  })

  it('uses the injected date for roles past deadline', () => {
    const past = new Date('2020-01-01T12:00:00Z')
    const overdue = makeBoard({ id: 'o1', deadline: '2019-12-31', openPositions: 1 })
    const upcoming = makeBoard({
      id: 'o2',
      name: 'Later Role',
      department: 'Engineering',
      deadline: '2021-01-01',
    })
    const summary = sheet(
      buildWorkbookModel({
        boards: [overdue, upcoming],
        months: [],
        hires: [],
        department: 'all',
        now: past,
      }),
      'Summary',
    )

    expect(summary.rows.slice(11)).toEqual([
      ['Engineering', 1, 2, 0, 0, 0],
      ['Design', 1, 1, 0, 0, 1],
    ])
  })

  it('passes formula-looking and numeric-looking text through unchanged', () => {
    const risky = makeBoard({
      id: 'b9',
      name: '=SUM(A1)',
      department: '@dept',
      candidates: [
        applicant('x', {
          boardId: 'b9',
          name: '+1',
          email: '-2',
          phone: '0821234567',
          currentRole: '@x',
        }),
      ],
    })
    const models = build('all', { boards: [risky] })
    const applicants = sheet(models, 'Applicants')

    expect(applicants.rows[0]).toEqual([
      '=SUM(A1)',
      '@dept',
      'Applied',
      'Active',
      '+1',
      '-2',
      '0821234567',
      '@x',
      utcDate(daysAgo(20).slice(0, 10)),
      3,
      0,
      null,
      null,
    ])
    expect(sheet(models, 'Active roles').rows[0]?.[0]).toBe('=SUM(A1)')
    expect(sheet(models, 'Pipeline').rows[0]?.[0]).toBe('=SUM(A1)')
  })
})

describe('Summary sheet', () => {
  it('lists the title, scope, six KPIs, the department table and the history note', () => {
    const summary = sheet(build(), 'Summary')

    expect(summary.columns).toHaveLength(6)
    expect(summary.rows).toEqual([
      ['TeamBuilder hiring overview', null, null, null, null, null],
      ['As at', utcDate('2026-11-15'), null, null, null, null],
      ['Scope', 'All departments', null, null, null, null],
      ['Open positions', 3, null, null, null, null],
      ['Active applicants', 5, null, null, null, null],
      ['At final stage', 1, null, null, null, null],
      ['Hired last 4 quarters', 4, null, null, null, null],
      ['Time to a hire (median days, last 4 quarters)', 30, null, null, null, null],
      ['Hire rate', 7 / 11, null, null, null, null],
      [null, null, null, null, null, null],
      [
        'By department',
        'Live roles',
        'Open positions',
        'Positions filled',
        'Active applicants',
        'Roles past deadline',
      ],
      ['Engineering', 1, 0, 0, 1, 0],
      ['Design', 1, 2, 1, 4, 1],
      ['Customer success', 1, 1, 0, 0, 0],
      [
        'Hiring history starts on June 2025; roles deleted earlier are not included.',
        null,
        null,
        null,
        null,
        null,
      ],
    ])
    expect(summary.kinds?.[1]).toEqual(['text', 'date', null, null, null, null])
    expect(summary.kinds?.[3]?.[1]).toBe('integer')
    expect(summary.kinds?.[7]?.[1]).toBe('days')
    expect(summary.kinds?.[8]?.[1]).toBe('percent')
    expect(summary.kinds?.[11]).toEqual([
      'text',
      'integer',
      'integer',
      'integer',
      'integer',
      'integer',
    ])
  })

  it('scopes the KPIs to a department and omits the note without history', () => {
    const scoped = sheet(build('Design'), 'Summary')

    expect(scoped.rows[2]).toEqual(['Scope', 'Design', null, null, null, null])
    expect(scoped.rows[3]?.[1]).toBe(2)
    expect(scoped.rows[6]?.[1]).toBe(2)
    expect(scoped.rows[11]).toEqual(['Design', 1, 2, 1, 4, 1])

    const empty = sheet(build('all', { months: [], hires: [] }), 'Summary')
    const labels = empty.rows.map((row) => row[0])

    expect(labels.some((label) => String(label).startsWith('Hiring history starts'))).toBe(false)
    expect(empty.rows[7]?.[1]).toBeNull()
    expect(empty.rows[8]?.[1]).toBeNull()
  })

  it('has table kinds only on the Summary sheet', () => {
    const models = build()

    expect(models.filter((model) => model.kinds !== undefined).map((model) => model.name)).toEqual([
      'Summary',
    ])
  })
})

describe('columnWidth', () => {
  it('clamps to a minimum of 8', () => {
    expect(columnWidth('Id', ['a'], 'text')).toBe(8)
  })

  it('clamps to a maximum of 48', () => {
    expect(columnWidth('Name', ['x'.repeat(200)], 'text')).toBe(48)
  })

  it('grows with the header and the longest value', () => {
    expect(columnWidth('Current role', [], 'text')).toBe(14)
    expect(columnWidth('Role', ['Senior Product Designer'], 'text')).toBe(25)
    expect(columnWidth('Role', [null, ''], 'text')).toBe(8)
  })

  it('uses the rendered length of typed values', () => {
    expect(columnWidth('Deadline', [new Date('2026-11-15T00:00:00Z')], 'date')).toBe(12)
    expect(columnWidth('Hires', [1234567], 'integer')).toBe(11)
    expect(columnWidth('Notice', [1.5], 'decimal')).toBe(8)
    expect(columnWidth('Notice period (months)', [12.5], 'decimal')).toBe(24)
    expect(columnWidth('N', [1234.56], 'decimal')).toBe(8)
    expect(columnWidth('Days', [-12], 'days')).toBe(8)
    expect(columnWidth('Salary', [1234567], 'rand')).toBe(13)
    expect(columnWidth('Rate', [0.5], 'percent')).toBe(8)
  })
})

describe('exportFileName', () => {
  it('names the all-departments file with the UTC date', () => {
    expect(exportFileName('all', now)).toBe('TeamBuilder-overview-all-departments-2026-11-15.xlsx')
  })

  it('slugs the department', () => {
    expect(exportFileName('Customer success', now)).toBe(
      'TeamBuilder-overview-customer-success-2026-11-15.xlsx',
    )
    expect(exportFileName('  R&D / Labs!! ', new Date('2026-01-02T23:59:59Z'))).toBe(
      'TeamBuilder-overview-r-d-labs-2026-01-02.xlsx',
    )
  })
})
