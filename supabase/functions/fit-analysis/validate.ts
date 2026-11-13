export interface FitAnalysisResult {
  schemaVersion: number
  similarities: string[]
  gaps: string[]
}

export class ModelResultError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelResultError'
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function asStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map((item) => asString(item, maxLength)).filter(Boolean))].slice(
    0,
    maxItems,
  )
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new ModelResultError('The model did not return a JSON object.')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    throw new ModelResultError('The model returned malformed JSON.')
  }

  const record = asRecord(parsed)

  if (!record) {
    throw new ModelResultError('The model returned an invalid result.')
  }

  return record
}

function normalizedToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function validateModelResult(content: string): FitAnalysisResult {
  const record = parseJsonObject(content)
  const similarities = asStringArray(record.similarities ?? record.strengths, 8, 400)
  const similarityTokens = new Set(similarities.map(normalizedToken))
  const gaps = asStringArray(record.gaps, 8, 400).filter(
    (gap) => !similarityTokens.has(normalizedToken(gap)),
  )

  if (!similarities.length && !gaps.length) {
    throw new ModelResultError('The model did not return any similarities or gaps.')
  }

  return {
    schemaVersion: 2,
    similarities,
    gaps,
  }
}
