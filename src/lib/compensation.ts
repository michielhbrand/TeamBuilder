const NOTICE_PERIOD_RE = /^\d+(?:\.\d)?$/
const RAND_RE = /^\d+(?:\.\d{1,2})?$/

export function parseNoticePeriod(value: string): number | null {
  const normalized = value.trim().replace(',', '.')

  if (!normalized) {
    return 0
  }

  if (!NOTICE_PERIOD_RE.test(normalized)) {
    return null
  }

  const months = Number(normalized)
  return Number.isFinite(months) ? months : null
}

export function formatNoticePeriod(months: number): string {
  return Number.isInteger(months) ? String(months) : months.toFixed(1)
}

export function parseSalaryToCents(value: string): number | null {
  const normalized = value.trim().replace(/^R\s*/i, '').replace(/\s/g, '').replace(',', '.')

  if (!normalized) {
    return 0
  }

  if (!RAND_RE.test(normalized)) {
    return null
  }

  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

export function formatSalaryCents(cents: number): string {
  return (Math.max(0, Math.round(cents)) / 100).toFixed(2)
}
