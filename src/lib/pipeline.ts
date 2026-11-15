import type {
  Board,
  BoardGroup,
  BoardSummary,
  Candidate,
  PipelineStep,
  PipelineTotals,
} from '@/types/pipeline'
import { departments } from '@/types/pipeline'

const DAY_MS = 86_400_000

export function stepById(board: Board, stepId: string): PipelineStep | undefined {
  return board.steps.find((step) => step.id === stepId)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function activeCandidates(board: Board): Candidate[] {
  return board.candidates.filter((candidate) => candidate.status === 'active')
}

export function candidatesInStep(board: Board, stepId: string): Candidate[] {
  return activeCandidates(board).filter((candidate) => candidate.stepId === stepId)
}

export function closedCandidates(board: Board, status: 'hired' | 'rejected'): Candidate[] {
  return board.candidates.filter((candidate) => candidate.status === status)
}

export function daysSince(isoDate: string, now: Date = new Date()): number {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return 0
  }

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS))
}

export function daysInStep(candidate: Candidate, now: Date = new Date()): number {
  return daysSince(candidate.stepEnteredAt, now)
}

export function daysSinceApplied(candidate: Candidate, now: Date = new Date()): number {
  return daysSince(candidate.appliedAt, now)
}

export function isOverdue(board: Board, now: Date = new Date()): boolean {
  return board.deadline < now.toISOString().slice(0, 10)
}

function parseIsoDate(deadline: string): Date | undefined {
  const parts = deadline.split('-').map(Number)

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return undefined
  }

  const [year, month, day] = parts as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatDeadline(deadline: string): string {
  const parts = deadline.split('-')

  if (parts.length !== 3) {
    return deadline
  }

  const [year, month, day] = parts

  return `${day?.padStart(2, '0')}/${month?.padStart(2, '0')}/${year}`
}

export function parseDeadlineInput(value: string): string | undefined {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (!match) {
    return undefined
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined
  }

  return date.toISOString().slice(0, 10)
}

export function daysUntilDeadline(deadline: string, now: Date = new Date()): number {
  const target = parseIsoDate(deadline)

  if (!target) {
    return 0
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  return Math.round((target.getTime() - today) / DAY_MS)
}

export function workDaysUntilDeadline(deadline: string, now: Date = new Date()): number {
  const days = daysUntilDeadline(deadline, now)

  if (days <= 0) {
    return 0
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  let workDays = 0

  for (let offset = 1; offset <= days; offset += 1) {
    const day = new Date(today + offset * DAY_MS).getUTCDay()

    if (day !== 0 && day !== 6) {
      workDays += 1
    }
  }

  return workDays
}

export function defaultApplicantStep(board: Board): PipelineStep | undefined {
  return board.steps.find((step) => step.name.trim().toLowerCase() === 'applied') ?? board.steps[0]
}

export function nextStep(board: Board, candidate: Candidate): PipelineStep | undefined {
  const index = board.steps.findIndex((step) => step.id === candidate.stepId)
  return index >= 0 ? board.steps[index + 1] : undefined
}

export function previousStep(board: Board, candidate: Candidate): PipelineStep | undefined {
  const index = board.steps.findIndex((step) => step.id === candidate.stepId)
  return index > 0 ? board.steps[index - 1] : undefined
}

export function isInFinalStep(board: Board, candidate: Candidate): boolean {
  const index = board.steps.findIndex((step) => step.id === candidate.stepId)
  return index === board.steps.length - 1
}

export function summariseBoard(board: Board): BoardSummary {
  const active = activeCandidates(board)

  return {
    board,
    active: active.length,
    overdue: isOverdue(board),
    hired: closedCandidates(board, 'hired').length,
    rejected: closedCandidates(board, 'rejected').length,
    stepCounts: board.steps.map((step) => ({
      step,
      count: active.filter((candidate) => candidate.stepId === step.id).length,
    })),
    pipelineCounts: board.steps.map(
      (step) => active.filter((candidate) => candidate.stepId === step.id).length,
    ),
  }
}

export function groupBoards(boards: Board[], order: readonly string[] = departments): BoardGroup[] {
  const grouped = new Map<string, Board[]>()

  for (const board of boards) {
    const list = grouped.get(board.department) ?? []
    list.push(board)
    grouped.set(board.department, list)
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }

  const known = new Set(order)
  const groups: BoardGroup[] = order
    .filter((department) => grouped.has(department))
    .map((department) => ({
      department,
      boards: grouped.get(department) ?? [],
    }))

  for (const [department, list] of grouped) {
    if (!known.has(department)) {
      groups.push({ department, boards: list })
    }
  }

  return groups
}

export function flattenBoards(groups: BoardGroup[]): Board[] {
  return groups.flatMap((group) => group.boards)
}

export function summariseBoards(boards: Board[]): PipelineTotals {
  return boards.reduce<PipelineTotals>(
    (totals, board) => {
      const summary = summariseBoard(board)
      totals.openPositions += board.openPositions
      totals.active += summary.active
      totals.overdue += summary.overdue ? 1 : 0
      totals.hired += summary.hired
      totals.rejected += summary.rejected
      return totals
    },
    { openPositions: 0, active: 0, overdue: 0, hired: 0, rejected: 0 },
  )
}

export function deadlineLabel(
  board: Board,
  now: Date = new Date(),
): { text: string; overdue: boolean } {
  const target = parseIsoDate(board.deadline)

  if (!target || Number.isNaN(target.getTime())) {
    return { text: 'No deadline', overdue: false }
  }

  const days = daysUntilDeadline(board.deadline, now)

  if (days < 0) {
    const late = Math.abs(days)
    return { text: `${late} ${late === 1 ? 'day' : 'days'} overdue`, overdue: true }
  }

  if (days === 0) {
    return { text: 'Due today', overdue: false }
  }

  if (days === 1) {
    return { text: 'Due tomorrow', overdue: false }
  }

  return { text: `Due in ${days} days`, overdue: false }
}

export function stageBreakdown(
  board: Board,
  limit = 3,
): { items: { name: string; count: number }[]; hidden: number } {
  return {
    items: board.steps.slice(0, limit).map((step) => ({
      name: step.name,
      count: candidatesInStep(board, step.id).length,
    })),
    hidden: Math.max(0, board.steps.length - limit),
  }
}

export function sortBoards(boards: Board[], key: 'deadline' | 'name' | 'active'): Board[] {
  const byName = (a: Board, b: Board) => a.name.localeCompare(b.name)

  return [...boards].sort((a, b) => {
    if (key === 'name') {
      return byName(a, b)
    }

    if (key === 'deadline') {
      return a.deadline.localeCompare(b.deadline) || byName(a, b)
    }

    return activeCandidates(b).length - activeCandidates(a).length || byName(a, b)
  })
}

export function applicantsInStage(board: Board, stepId: string): number {
  return board.candidates.filter((candidate) => candidate.stepId === stepId).length
}

export function reorderIds(ids: string[], from: number, to: number): string[] {
  const result = [...ids]

  if (from < 1 || to < 1 || from >= ids.length || to >= ids.length || from === to) {
    return result
  }

  const [moved] = result.splice(from, 1)
  result.splice(to, 0, moved as string)

  return result
}

export function applicantActions(
  board: Board,
  candidate: Candidate,
): {
  next?: PipelineStep
  previous?: PipelineStep
  canHire: boolean
  canReject: boolean
  canReopen: boolean
} {
  if (candidate.status !== 'active') {
    return { canHire: false, canReject: false, canReopen: true }
  }

  return {
    next: nextStep(board, candidate),
    previous: previousStep(board, candidate),
    canHire: true,
    canReject: true,
    canReopen: false,
  }
}
