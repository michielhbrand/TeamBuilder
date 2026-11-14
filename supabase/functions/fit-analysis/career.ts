export interface CareerEntry {
  title: string
  organization: string
  start: string
  end: string
  current: boolean
  description: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function monthLabel(value: string): string {
  const match = MONTH_RE.exec(value)
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : ''
}

function period(entry: CareerEntry): string {
  const start = monthLabel(entry.start)
  const end = entry.current ? 'Present' : monthLabel(entry.end)

  if (!start && !end) {
    return ''
  }

  return `${start || '?'} – ${end || '?'}`
}

export function formatCareerEntries(value: unknown): string {
  if (!Array.isArray(value)) {
    return ''
  }

  const blocks = value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const entry: CareerEntry = {
        title: text(item.title),
        organization: text(item.organization),
        start: text(item.start),
        end: text(item.end),
        current: item.current === true,
        description: text(item.description),
      }
      const heading = [entry.title, entry.organization].filter(Boolean).join(' — ')

      return [heading, period(entry), entry.description].filter(Boolean).join('\n')
    })
    .filter(Boolean)

  return blocks.join('\n\n')
}
