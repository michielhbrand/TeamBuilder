import type { CareerEntry } from '@/types/pipeline'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const GAP_THRESHOLD_MONTHS = 3

export type CareerLane = 'experience' | 'education'

export interface StripBar {
  entry: CareerEntry
  lane: CareerLane
  left: number
  width: number
}

export interface StripTick {
  year: number
  left: number
}

export interface StripGap {
  from: string
  to: string
  months: number
  left: number
  width: number
}

export interface StripLayout {
  ticks: StripTick[]
  lanes: Array<{ lane: CareerLane; rows: StripBar[][] }>
  gaps: StripGap[]
}

export function nowMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function createCareerEntry(partial: Partial<CareerEntry> = {}): CareerEntry {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `entry-${Math.random().toString(36).slice(2)}`,
    title: '',
    organization: '',
    start: '',
    end: '',
    current: false,
    description: '',
    ...partial,
  }
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asMonth(value: unknown): string {
  return typeof value === 'string' && MONTH_RE.test(value) ? value : ''
}

export function normalizeEntries(value: unknown): CareerEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const current = item.current === true

      return {
        id: asText(item.id) || createCareerEntry().id,
        title: asText(item.title),
        organization: asText(item.organization),
        start: asMonth(item.start),
        end: current ? '' : asMonth(item.end),
        current,
        description: asText(item.description),
      }
    })
}

export function isEntryEmpty(entry: CareerEntry): boolean {
  return (
    !entry.title.trim() &&
    !entry.organization.trim() &&
    !entry.start &&
    !entry.end &&
    !entry.current &&
    !entry.description.trim()
  )
}

export function serializeEntries(entries: CareerEntry[]): CareerEntry[] {
  return entries
    .filter((entry) => !isEntryEmpty(entry))
    .map((entry) => ({
      id: entry.id,
      title: entry.title.trim(),
      organization: entry.organization.trim(),
      start: entry.start,
      end: entry.current ? '' : entry.end,
      current: entry.current,
      description: entry.description.trim(),
    }))
}

export function entriesEqual(left: CareerEntry[], right: CareerEntry[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function hasCareerContent(education: CareerEntry[], experience: CareerEntry[]): boolean {
  return [...education, ...experience].some((entry) => !isEntryEmpty(entry))
}

function monthIndex(value: string): number {
  const match = MONTH_RE.exec(value)
  return match ? Number(match[1]) * 12 + Number(match[2]) : 0
}

export function monthsBetween(from: string, to: string): number {
  return monthIndex(to) - monthIndex(from)
}

export function formatMonth(value: string): string {
  const match = MONTH_RE.exec(value)
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : ''
}

export function endMonth(entry: CareerEntry, now = nowMonth()): string {
  return entry.current ? now : entry.end
}

export function hasValidSpan(entry: CareerEntry, now = nowMonth()): boolean {
  const end = endMonth(entry, now)
  return Boolean(entry.start && end && monthsBetween(entry.start, end) >= 0)
}

export function formatPeriod(entry: CareerEntry): string {
  if (!entry.start && !entry.end && !entry.current) {
    return ''
  }

  return `${formatMonth(entry.start) || '?'} – ${entry.current ? 'Present' : formatMonth(entry.end) || '?'}`
}

export function formatMonths(total: number): string {
  const years = Math.floor(total / 12)
  const months = total % 12
  const parts = [
    years ? `${years} ${years === 1 ? 'yr' : 'yrs'}` : '',
    months ? `${months} ${months === 1 ? 'mo' : 'mos'}` : '',
  ].filter(Boolean)

  return parts.join(' ') || '0 mos'
}

export function entryDuration(entry: CareerEntry, now = nowMonth()): string {
  return hasValidSpan(entry, now)
    ? formatMonths(monthsBetween(entry.start, endMonth(entry, now)) + 1)
    : ''
}

export function sortEntries(entries: CareerEntry[]): CareerEntry[] {
  return [...entries].sort((left, right) => {
    if (left.start !== right.start) {
      if (!left.start) return 1
      if (!right.start) return -1
      return right.start.localeCompare(left.start)
    }

    return left.id.localeCompare(right.id)
  })
}

export function totalMonths(entries: CareerEntry[], now = nowMonth()): number {
  const intervals = entries
    .filter((entry) => hasValidSpan(entry, now))
    .map((entry) => [monthIndex(entry.start), monthIndex(endMonth(entry, now))] as const)
    .sort((left, right) => left[0] - right[0])

  let total = 0
  let current: [number, number] | null = null

  for (const [start, end] of intervals) {
    if (current && start <= current[1] + 1) {
      current[1] = Math.max(current[1], end)
    } else {
      if (current) {
        total += current[1] - current[0] + 1
      }

      current = [start, end]
    }
  }

  return current ? total + current[1] - current[0] + 1 : 0
}

export function employmentGaps(
  entries: CareerEntry[],
  now = nowMonth(),
): Array<{ from: string; to: string; months: number }> {
  const gaps: Array<{ from: string; to: string; months: number }> = []
  let latestEnd = ''

  const dated = entries
    .filter((entry) => hasValidSpan(entry, now))
    .sort((left, right) => left.start.localeCompare(right.start))

  for (const entry of dated) {
    const distance = latestEnd ? monthsBetween(latestEnd, entry.start) : 0

    if (latestEnd && distance > GAP_THRESHOLD_MONTHS) {
      gaps.push({ from: latestEnd, to: entry.start, months: distance - 1 })
    }

    const end = endMonth(entry, now)

    if (end > latestEnd) {
      latestEnd = end
    }
  }

  return gaps
}

export function layoutStrip(
  experience: CareerEntry[],
  education: CareerEntry[],
  lanes: CareerLane[],
  now = nowMonth(),
): StripLayout | null {
  const sources: Record<CareerLane, CareerEntry[]> = { experience, education }
  const all = lanes.flatMap((lane) => sources[lane].filter((entry) => hasValidSpan(entry, now)))

  if (!all.length) {
    return null
  }

  const min = all.reduce(
    (value, entry) => (entry.start < value ? entry.start : value),
    all[0]!.start,
  )
  const max = all.reduce(
    (value, entry) => (endMonth(entry, now) > value ? endMonth(entry, now) : value),
    endMonth(all[0]!, now),
  )
  const total = monthsBetween(min, max) + 1
  const percent = (months: number): number => (months / total) * 100
  const firstYear = Number(min.slice(0, 4))
  const lastYear = Number(max.slice(0, 4))
  const step = Math.max(1, Math.ceil((lastYear - firstYear) / 5))
  const ticks: StripTick[] = []

  for (let year = firstYear; year <= lastYear; year += step) {
    const position = monthsBetween(min, `${year}-01`)

    if (position >= 0) {
      ticks.push({ year, left: percent(position) })
    }
  }

  const laneLayouts = lanes.map((lane) => {
    const rows: Array<{ end: string; bars: StripBar[] }> = []
    const entries = sources[lane]
      .filter((entry) => hasValidSpan(entry, now))
      .sort((left, right) => left.start.localeCompare(right.start))

    for (const entry of entries) {
      let row = rows.find((candidate) => monthsBetween(candidate.end, entry.start) > 0)

      if (!row) {
        row = { end: '', bars: [] }
        rows.push(row)
      }

      row.bars.push({
        entry,
        lane,
        left: percent(monthsBetween(min, entry.start)),
        width: percent(monthsBetween(entry.start, endMonth(entry, now)) + 1),
      })

      if (endMonth(entry, now) > row.end) {
        row.end = endMonth(entry, now)
      }
    }

    return { lane, rows: rows.map((row) => row.bars) }
  })

  const gaps = lanes.includes('experience')
    ? employmentGaps(experience, now).map((gap) => ({
        ...gap,
        left: percent(monthsBetween(min, gap.from) + 1),
        width: percent(gap.months),
      }))
    : []

  return { ticks, lanes: laneLayouts, gaps }
}

export function formatEntriesText(entries: CareerEntry[]): string {
  return entries
    .map((entry) => {
      const heading = [entry.title.trim(), entry.organization.trim()].filter(Boolean).join(' — ')
      return [heading, formatPeriod(entry), entry.description.trim()].filter(Boolean).join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}
