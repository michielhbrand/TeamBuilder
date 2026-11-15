import {
  activeCandidates,
  daysInStep,
  daysSince,
  daysUntilDeadline,
  deadlineLabel,
} from '@/lib/pipeline'
import type { HireRecord, HiringMonth } from '@/types/history'
import type { Board } from '@/types/pipeline'

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const position = Math.min(1, Math.max(0, p)) * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const low = sorted[lower] as number
  const high = sorted[upper] as number

  return low + (high - low) * (position - lower)
}

export function median(values: number[]): number | null {
  return percentile(values, 0.5)
}

export function quarterKey(date: string): string {
  const year = date.slice(0, 4)
  const month = Number(date.slice(5, 7))

  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`
}

export function quarterLabel(key: string): string {
  const [year, quarter] = key.split('-')

  return `${quarter} ${year?.slice(2)}`
}

export function recentQuarters(now: Date, count: number): string[] {
  const index = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3)
  const keys: string[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const value = index - offset
    keys.push(`${Math.floor(value / 4)}-Q${(value % 4) + 1}`)
  }

  return keys
}

export interface QuarterPoint {
  key: string
  label: string
  partial: boolean
  applicantsIn: number
  hired: number
  rejected: number
}

function inDepartment(department: string | 'all', value: string): boolean {
  return department === 'all' || value === department
}

export function quarterSeries(
  months: HiringMonth[],
  department: string | 'all',
  count: number,
  now: Date = new Date(),
): QuarterPoint[] {
  const requested = recentQuarters(now, count)
  const current = requested[requested.length - 1] as string
  const earliest = months.map((entry) => quarterKey(entry.month)).sort()[0]
  const keys = earliest ? requested.filter((key) => key >= earliest) : []

  if (keys.length === 0) {
    keys.push(current)
  }

  return keys.map((key) => {
    const point: QuarterPoint = {
      key,
      label: quarterLabel(key),
      partial: key === current,
      applicantsIn: 0,
      hired: 0,
      rejected: 0,
    }

    for (const entry of months) {
      if (inDepartment(department, entry.department) && quarterKey(entry.month) === key) {
        point.applicantsIn += entry.applicantsIn
        point.hired += entry.hired
        point.rejected += entry.rejected
      }
    }

    return point
  })
}

export function hireRate(
  months: HiringMonth[],
  department: string | 'all',
): { hired: number; rejected: number; percent: number | null } {
  let hired = 0
  let rejected = 0

  for (const entry of months) {
    if (inDepartment(department, entry.department)) {
      hired += entry.hired
      rejected += entry.rejected
    }
  }

  const decided = hired + rejected

  return { hired, rejected, percent: decided > 0 ? Math.round((hired / decided) * 100) : null }
}

export function hiresInQuarters(
  hires: HireRecord[],
  department: string | 'all',
  keys: string[],
): HireRecord[] {
  const wanted = new Set(keys)

  return hires.filter(
    (hire) => inDepartment(department, hire.department) && wanted.has(quarterKey(hire.hiredOn)),
  )
}

export interface HireRange {
  department: string
  count: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export function rangeByDepartment(hires: HireRecord[]): HireRange[] {
  const grouped = new Map<string, number[]>()

  for (const hire of hires) {
    const list = grouped.get(hire.department) ?? []
    list.push(hire.daysToHire)
    grouped.set(hire.department, list)
  }

  return [...grouped].map(([department, days]) => ({
    department,
    count: days.length,
    min: Math.min(...days),
    q1: percentile(days, 0.25) as number,
    median: percentile(days, 0.5) as number,
    q3: percentile(days, 0.75) as number,
    max: Math.max(...days),
  }))
}

export function speedCurve(hires: HireRecord[]): { days: number; share: number }[] {
  const days = hires.map((hire) => hire.daysToHire).sort((a, b) => a - b)

  return days.map((value, index) => ({ days: value, share: (index + 1) / days.length }))
}

export function medianByQuarter(
  hires: HireRecord[],
  keys: string[],
): { key: string; median: number | null }[] {
  return keys.map((key) => ({
    key,
    median: median(
      hires.filter((hire) => quarterKey(hire.hiredOn) === key).map((hire) => hire.daysToHire),
    ),
  }))
}

export interface AttentionItem {
  kind: 'overdue' | 'final' | 'stalled' | 'due-soon'
  boardId: string
  title: string
  detail: string
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function finalStageCount(board: Board): number {
  const last = board.steps[board.steps.length - 1]

  if (!last) {
    return 0
  }

  return activeCandidates(board).filter((candidate) => candidate.stepId === last.id).length
}

export interface StageStat {
  stepId: string
  name: string
  count: number
  medianDays: number | null
}

export function stageStats(board: Board, now: Date = new Date()): StageStat[] {
  const active = activeCandidates(board)

  return board.steps.map((step) => {
    const inStep = active.filter((candidate) => candidate.stepId === step.id)

    return {
      stepId: step.id,
      name: step.name,
      count: inStep.length,
      medianDays: median(inStep.map((candidate) => daysInStep(candidate, now))),
    }
  })
}

export function slowestStage(stats: StageStat[]): StageStat | undefined {
  let slowest: StageStat | undefined

  for (const stat of stats) {
    if (
      stat.medianDays !== null &&
      (!slowest || stat.medianDays > (slowest.medianDays as number))
    ) {
      slowest = stat
    }
  }

  return slowest
}

export function attentionItems(boards: Board[], now: Date = new Date()): AttentionItem[] {
  const overdue = boards
    .filter((board) => daysUntilDeadline(board.deadline, now) < 0)
    .sort((a, b) => daysUntilDeadline(a.deadline, now) - daysUntilDeadline(b.deadline, now))
    .map<AttentionItem>((board) => {
      const late = Math.abs(daysUntilDeadline(board.deadline, now))
      const hired = board.candidates.filter((candidate) => candidate.status === 'hired').length

      return {
        kind: 'overdue',
        boardId: board.id,
        title: `${board.name} is ${plural(late, 'day')} past its deadline`,
        detail: `${plural(activeCandidates(board).length, 'active applicant')} · ${hired} of ${plural(board.openPositions, 'position')} filled`,
      }
    })

  const final: AttentionItem[] = []

  for (const board of boards) {
    const count = finalStageCount(board)
    const last = board.steps[board.steps.length - 1]

    if (count > 0 && last) {
      const stat = stageStats(board, now).find((entry) => entry.stepId === last.id)

      final.push({
        kind: 'final',
        boardId: board.id,
        title: `${count} ${count === 1 ? 'applicant is' : 'applicants are'} at the final stage (${last.name}) for ${board.name}`,
        detail: `Median ${plural(Math.round(stat?.medianDays ?? 0), 'day')} at this stage`,
      })
    }
  }

  const stalled: AttentionItem[] = []

  for (const board of boards) {
    const active = activeCandidates(board)
    const first = board.steps[0]

    if (
      first &&
      board.steps.length > 1 &&
      active.length > 0 &&
      active.every((candidate) => candidate.stepId === first.id) &&
      daysSince(board.openedAt, now) >= 7
    ) {
      stalled.push({
        kind: 'stalled',
        boardId: board.id,
        title: `Nobody has left the first stage for ${board.name}`,
        detail: `${plural(active.length, 'applicant')}, all in ${first.name} · ${deadlineLabel(board, now).text.toLowerCase()}`,
      })
    }
  }

  const dueSoon = boards
    .filter((board) => {
      const days = daysUntilDeadline(board.deadline, now)
      return days >= 0 && days <= 14
    })
    .map<AttentionItem>((board) => {
      const days = daysUntilDeadline(board.deadline, now)
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
      const hired = board.candidates.filter((candidate) => candidate.status === 'hired').length

      return {
        kind: 'due-soon',
        boardId: board.id,
        title: `${board.name} is due ${when}`,
        detail: `${plural(board.openPositions, 'open position')} · ${hired} filled`,
      }
    })

  return [...overdue, ...final, ...stalled, ...dueSoon]
}

export interface RoleFlow {
  boardId: string
  name: string
  total: number
  hired: number
  rejected: number
  active: number
}

export function roleFlow(board: Board): RoleFlow {
  const count = (status: string) =>
    board.candidates.filter((candidate) => candidate.status === status).length

  return {
    boardId: board.id,
    name: board.name,
    total: board.candidates.length,
    hired: count('hired'),
    rejected: count('rejected'),
    active: count('active'),
  }
}

export function filledShare(board: Board): { hired: number; open: number; share: number } {
  const hired = board.candidates.filter((candidate) => candidate.status === 'hired').length
  const open = board.openPositions

  return { hired, open, share: open > 0 ? Math.min(1, hired / open) : 0 }
}

export function openedDaysAgo(board: Board, now: Date = new Date()): number {
  return daysSince(board.openedAt, now)
}
