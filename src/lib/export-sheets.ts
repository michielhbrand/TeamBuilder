import {
  hireRate,
  hiresInQuarters,
  median,
  percentile,
  quarterKey,
  quarterSeries,
  recentQuarters,
  finalStageCount,
} from '@/lib/overview'
import { activeCandidates, daysInStep, daysUntilDeadline } from '@/lib/pipeline'
import type { HireRecord, HiringMonth } from '@/types/history'
import {
  departments as knownDepartments,
  type Board,
  type Candidate,
  type CandidateStatus,
} from '@/types/pipeline'

export type CellKind = 'text' | 'date' | 'integer' | 'decimal' | 'rand' | 'percent' | 'days'

export interface ExportColumn {
  header: string
  kind: CellKind
  key: string
}

export type ExportValue = string | number | Date | null

export interface SheetModel {
  name: string
  layout: 'table' | 'summary'
  landscape: boolean
  columns: ExportColumn[]
  rows: ExportValue[][]
  kinds?: (CellKind | null)[][]
}

export interface ExportInput {
  boards: Board[]
  months: HiringMonth[]
  hires: HireRecord[]
  department: string | 'all'
  now?: Date
}

const ALL_DEPARTMENTS = 'All departments'
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const STATUS_LABELS: Record<CandidateStatus, string> = {
  active: 'Active',
  hired: 'Hired',
  rejected: 'Rejected',
}

function column(header: string, kind: CellKind): ExportColumn {
  return { header, kind, key: header.toLowerCase().replace(/[^a-z0-9]+/g, '-') }
}

function textOrNull(value: string): string | null {
  return value === '' ? null : value
}

function utcDay(value: Date): Date | null {
  if (Number.isNaN(value.getTime())) {
    return null
  }

  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function isoDay(value: string): Date | null {
  return utcDay(new Date(`${value}T00:00:00Z`))
}

function departmentRank(name: string): number {
  const index = knownDepartments.indexOf(name as (typeof knownDepartments)[number])

  return index === -1 ? knownDepartments.length : index
}

function byDepartment(a: string, b: string): number {
  return departmentRank(a) - departmentRank(b) || a.localeCompare(b)
}

function byBoardName(a: Board, b: Board): number {
  return a.name.localeCompare(b.name) || a.department.localeCompare(b.department)
}

function wholeDays(value: number | null): number | null {
  return value === null ? null : Math.round(value)
}

function statusCount(board: Board, status: CandidateStatus): number {
  return board.candidates.filter((candidate) => candidate.status === status).length
}

function buildActiveRoles(boards: Board[], now: Date): SheetModel {
  const sorted = [...boards].sort(
    (a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name),
  )

  return {
    name: 'Active roles',
    layout: 'table',
    landscape: true,
    columns: [
      column('Role', 'text'),
      column('Department', 'text'),
      column('Open positions', 'integer'),
      column('Filled', 'integer'),
      column('Deadline', 'date'),
      column('Days to deadline', 'days'),
      column('Opened', 'date'),
      column('Stages', 'integer'),
      column('Active', 'integer'),
      column('Hired', 'integer'),
      column('Rejected', 'integer'),
      column('At final stage', 'integer'),
    ],
    rows: sorted.map((board) => [
      board.name,
      board.department,
      board.openPositions,
      statusCount(board, 'hired'),
      isoDay(board.deadline),
      daysUntilDeadline(board.deadline, now),
      utcDay(new Date(board.openedAt)),
      board.steps.length,
      statusCount(board, 'active'),
      statusCount(board, 'hired'),
      statusCount(board, 'rejected'),
      finalStageCount(board),
    ]),
  }
}

function applicantRow(board: Board, candidate: Candidate, now: Date): ExportValue[] {
  const step = board.steps.find((entry) => entry.id === candidate.stepId)

  return [
    board.name,
    board.department,
    step?.name ?? null,
    STATUS_LABELS[candidate.status],
    candidate.name,
    textOrNull(candidate.email),
    textOrNull(candidate.phone),
    textOrNull(candidate.currentRole),
    utcDay(new Date(candidate.appliedAt)),
    candidate.status === 'active' ? daysInStep(candidate, now) : null,
    candidate.noticePeriodMonths,
    candidate.salaryExpectationCents > 0 ? candidate.salaryExpectationCents / 100 : null,
    candidate.favorite ? 'Yes' : null,
  ]
}

function buildApplicants(boards: Board[], now: Date): SheetModel {
  const rows: ExportValue[][] = []

  for (const board of [...boards].sort(byBoardName)) {
    const position = (candidate: Candidate) =>
      board.steps.find((step) => step.id === candidate.stepId)?.position ?? Number.MAX_SAFE_INTEGER
    const sorted = [...board.candidates].sort(
      (a, b) => position(a) - position(b) || a.name.localeCompare(b.name),
    )

    for (const candidate of sorted) {
      rows.push(applicantRow(board, candidate, now))
    }
  }

  return {
    name: 'Applicants',
    layout: 'table',
    landscape: true,
    columns: [
      column('Role', 'text'),
      column('Department', 'text'),
      column('Stage', 'text'),
      column('Status', 'text'),
      column('Applicant', 'text'),
      column('Email', 'text'),
      column('Phone', 'text'),
      column('Current role', 'text'),
      column('Applied', 'date'),
      column('Days in stage', 'days'),
      column('Notice period (months)', 'decimal'),
      column('Salary expectation (rand)', 'rand'),
      column('Favorite', 'text'),
    ],
    rows,
  }
}

function buildPipeline(boards: Board[]): SheetModel {
  const rows: ExportValue[][] = []

  for (const board of [...boards].sort(byBoardName)) {
    const active = activeCandidates(board)
    const steps = [...board.steps].sort((a, b) => a.position - b.position)

    steps.forEach((step, index) => {
      rows.push([
        board.name,
        board.department,
        index + 1,
        step.name,
        active.filter((candidate) => candidate.stepId === step.id).length,
      ])
    })
  }

  return {
    name: 'Pipeline',
    layout: 'table',
    landscape: false,
    columns: [
      column('Role', 'text'),
      column('Department', 'text'),
      column('Stage number', 'integer'),
      column('Stage', 'text'),
      column('Active applicants', 'integer'),
    ],
    rows,
  }
}

function exportQuarter(key: string): string {
  return key.replace('-', ' ')
}

function buildHiringByQuarter(months: HiringMonth[], department: string | 'all'): SheetModel {
  const totals = new Map<string, Map<string, [number, number, number]>>()

  for (const entry of months) {
    const key = quarterKey(entry.month)
    const quarter = totals.get(key) ?? new Map<string, [number, number, number]>()
    const sums = quarter.get(entry.department) ?? [0, 0, 0]

    sums[0] += entry.applicantsIn
    sums[1] += entry.hired
    sums[2] += entry.rejected
    quarter.set(entry.department, sums)
    totals.set(key, quarter)
  }

  const rate = (hired: number, rejected: number) =>
    hired + rejected > 0 ? hired / (hired + rejected) : null
  const rows: ExportValue[][] = []

  for (const key of [...totals.keys()].sort()) {
    const quarter = totals.get(key) as Map<string, [number, number, number]>
    const sum: [number, number, number] = [0, 0, 0]

    for (const name of [...quarter.keys()].sort(byDepartment)) {
      const [applicantsIn, hired, rejected] = quarter.get(name) as [number, number, number]

      rows.push([exportQuarter(key), name, applicantsIn, hired, rejected, rate(hired, rejected)])
      sum[0] += applicantsIn
      sum[1] += hired
      sum[2] += rejected
    }

    if (department === 'all') {
      rows.push([exportQuarter(key), ALL_DEPARTMENTS, sum[0], sum[1], sum[2], rate(sum[1], sum[2])])
    }
  }

  return {
    name: 'Hiring by quarter',
    layout: 'table',
    landscape: false,
    columns: [
      column('Quarter', 'text'),
      column('Department', 'text'),
      column('Applicants in', 'integer'),
      column('Hired', 'integer'),
      column('Rejected', 'integer'),
      column('Hire rate', 'percent'),
    ],
    rows,
  }
}

function timeToHireRow(name: string, records: HireRecord[], recent: string[]): ExportValue[] {
  const days = records.map((record) => record.daysToHire)
  const recentDays = hiresInQuarters(records, 'all', recent).map((record) => record.daysToHire)

  return [
    name,
    records.length,
    wholeDays(median(days)),
    wholeDays(
      days.reduce<number | null>((low, day) => (low === null || day < low ? day : low), null),
    ),
    wholeDays(
      days.reduce<number | null>((high, day) => (high === null || day > high ? day : high), null),
    ),
    wholeDays(percentile(days, 0.25)),
    wholeDays(percentile(days, 0.75)),
    wholeDays(median(recentDays)),
  ]
}

function buildTimeToHire(hires: HireRecord[], department: string | 'all', now: Date): SheetModel {
  const recent = recentQuarters(now, 4)
  const names = [...new Set(hires.map((record) => record.department))].sort(byDepartment)
  const rows = names.map((name) =>
    timeToHireRow(
      name,
      hires.filter((record) => record.department === name),
      recent,
    ),
  )

  if (department === 'all') {
    rows.push(timeToHireRow(ALL_DEPARTMENTS, hires, recent))
  }

  return {
    name: 'Time to hire',
    layout: 'table',
    landscape: false,
    columns: [
      column('Department', 'text'),
      column('Hires (last 12 quarters)', 'integer'),
      column('Median days', 'days'),
      column('Fastest', 'days'),
      column('Slowest', 'days'),
      column('Quartile 1', 'days'),
      column('Quartile 3', 'days'),
      column('Median (last 4 quarters)', 'days'),
    ],
    rows,
  }
}

function historyStart(months: HiringMonth[]): string | null {
  const earliest = months.map((entry) => entry.month).sort()[0]

  if (!earliest) {
    return null
  }

  const name = MONTH_NAMES[Number(earliest.slice(5, 7)) - 1]

  return name ? `${name} ${earliest.slice(0, 4)}` : null
}

function boardTotals(
  boards: Board[],
  now: Date,
): { openPositions: number; active: number; hired: number; overdue: number } {
  return boards.reduce(
    (totals, board) => {
      totals.openPositions += board.openPositions
      totals.active += statusCount(board, 'active')
      totals.hired += statusCount(board, 'hired')
      totals.overdue += daysUntilDeadline(board.deadline, now) < 0 ? 1 : 0
      return totals
    },
    { openPositions: 0, active: 0, hired: 0, overdue: 0 },
  )
}

function buildSummary(
  boards: Board[],
  months: HiringMonth[],
  hires: HireRecord[],
  department: string | 'all',
  now: Date,
): SheetModel {
  const width = 6
  const rows: ExportValue[][] = []
  const kinds: (CellKind | null)[][] = []
  const pad = (cells: ExportValue[]) =>
    cells.concat(Array.from({ length: width - cells.length }, () => null))
  const padKinds = (cells: (CellKind | null)[]) =>
    cells.concat(Array.from({ length: width - cells.length }, () => null))
  const add = (cells: ExportValue[], cellKinds: (CellKind | null)[]) => {
    rows.push(pad(cells))
    kinds.push(padKinds(cellKinds))
  }

  const totals = boardTotals(boards, now)
  const finalStage = boards.reduce((sum, board) => sum + finalStageCount(board), 0)
  const hiredRecently = quarterSeries(months, department, 4, now).reduce(
    (sum, point) => sum + point.hired,
    0,
  )
  const hireDays = wholeDays(
    median(
      hiresInQuarters(hires, department, recentQuarters(now, 4)).map((record) => record.daysToHire),
    ),
  )
  const decisions = hireRate(months, department)
  const rate =
    decisions.hired + decisions.rejected > 0
      ? decisions.hired / (decisions.hired + decisions.rejected)
      : null

  add(['TeamBuilder hiring overview'], ['text'])
  add(['As at', utcDay(now)], ['text', 'date'])
  add(['Scope', department === 'all' ? ALL_DEPARTMENTS : department], ['text', 'text'])
  add(['Open positions', totals.openPositions], ['text', 'integer'])
  add(['Active applicants', totals.active], ['text', 'integer'])
  add(['At final stage', finalStage], ['text', 'integer'])
  add(['Hired last 4 quarters', hiredRecently], ['text', 'integer'])
  add(['Time to a hire (median days, last 4 quarters)', hireDays], ['text', 'days'])
  add(['Hire rate', rate], ['text', 'percent'])
  add([], [])
  add(
    [
      'By department',
      'Live roles',
      'Open positions',
      'Positions filled',
      'Active applicants',
      'Roles past deadline',
    ],
    ['text', 'text', 'text', 'text', 'text', 'text'],
  )

  const names = [...new Set(boards.map((board) => board.department))].sort(byDepartment)

  for (const name of names) {
    const inDepartment = boards.filter((board) => board.department === name)
    const sums = boardTotals(inDepartment, now)

    add(
      [name, inDepartment.length, sums.openPositions, sums.hired, sums.active, sums.overdue],
      ['text', 'integer', 'integer', 'integer', 'integer', 'integer'],
    )
  }

  const start = historyStart(months)

  if (start) {
    add([`Hiring history starts on ${start}; roles deleted earlier are not included.`], ['text'])
  }

  return {
    name: 'Summary',
    layout: 'summary',
    landscape: false,
    columns: [
      column('Label', 'text'),
      column('Value', 'text'),
      column('Live roles', 'text'),
      column('Positions filled', 'text'),
      column('Active applicants', 'text'),
      column('Roles past deadline', 'text'),
    ],
    rows,
    kinds,
  }
}

export function buildWorkbookModel(input: ExportInput): SheetModel[] {
  const now = input.now ?? new Date()
  const { department } = input
  const inScope = (name: string) => department === 'all' || name === department
  const boards = input.boards.filter((board) => inScope(board.department))
  const months = input.months.filter((entry) => inScope(entry.department))
  const hires = input.hires.filter((record) => inScope(record.department))

  return [
    buildSummary(boards, months, hires, department, now),
    buildActiveRoles(boards, now),
    buildApplicants(boards, now),
    buildPipeline(boards),
    buildHiringByQuarter(months, department),
    buildTimeToHire(hires, department, now),
  ]
}

function renderedLength(value: ExportValue, kind: CellKind): number {
  if (value === null || value === '') {
    return 0
  }

  if (kind === 'date') {
    return 10
  }

  if (kind === 'percent') {
    return 4
  }

  if (kind === 'decimal') {
    return String(Math.round(Number(value) * 10) / 10).length
  }

  if (typeof value === 'number') {
    const digits = Math.round(value).toLocaleString('en-US')

    return kind === 'rand' ? `R ${digits}`.length : digits.length
  }

  return String(value).length
}

export function columnWidth(header: string, values: ExportValue[], kind: CellKind): number {
  const longest = values.reduce<number>(
    (max, value) => Math.max(max, renderedLength(value, kind)),
    0,
  )

  return Math.min(48, Math.max(8, Math.max(header.length, longest) + 2))
}

export function exportFileName(department: string | 'all', now: Date = new Date()): string {
  const slug =
    department === 'all'
      ? 'all-departments'
      : department
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

  return `TeamBuilder-overview-${slug || 'department'}-${now.toISOString().slice(0, 10)}.xlsx`
}
