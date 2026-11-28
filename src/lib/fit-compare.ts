import { compareFitSummaries, type FitRequirementCounts, type FitSummary } from '@/lib/fit-rank'
import type { FitWeightKey, FitWeights } from '@/types/fit'

export type FitComparisonMode = 'default' | 'custom'

export type FitComparisonSelection = Record<FitWeightKey, boolean>

export interface FitComparisonEntry {
  applicantId: string
  name: string
  stageName: string
  summary: FitSummary
}

export interface FitComparisonOptions {
  mode: FitComparisonMode
  weights: FitWeights
  selection: FitComparisonSelection
}

export interface FitComparisonRow extends FitComparisonEntry {
  shares: Record<FitWeightKey, number | null>
  total: number | null
  tier: 0 | 1
  comparable: boolean
}

export const FIT_WEIGHT_KEYS: FitWeightKey[] = ['minimum', 'recommended', 'skills']

export const DEFAULT_FIT_WEIGHTS: FitWeights = {
  minimum: 50,
  recommended: 30,
  skills: 20,
}

export const DEFAULT_FIT_SELECTION: FitComparisonSelection = {
  minimum: true,
  recommended: true,
  skills: true,
}

export function fitWeightsTotal(weights: FitWeights): number {
  return Number(weights.minimum) + Number(weights.recommended) + Number(weights.skills)
}

export function isValidFitWeights(value: unknown): value is FitWeights {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  const numbers = FIT_WEIGHT_KEYS.map((key) => record[key])

  if (
    !numbers.every(
      (number) =>
        typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 100,
    )
  ) {
    return false
  }

  return Math.abs(fitWeightsTotal(value as FitWeights) - 100) < 0.001
}

export function parseFitWeights(value: unknown): FitWeights {
  return isValidFitWeights(value) ? { ...value } : { ...DEFAULT_FIT_WEIGHTS }
}

export function rebalanceWeights(
  weights: FitWeights,
  key: FitWeightKey,
  value: number,
): FitWeights {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  const firstKey: FitWeightKey = key === 'minimum' ? 'recommended' : 'minimum'
  const secondKey: FitWeightKey = key === 'skills' ? 'recommended' : 'skills'
  const remaining = 100 - clamped
  const otherTotal = Number(weights[firstKey]) + Number(weights[secondKey])
  const first =
    otherTotal > 0
      ? Math.round((remaining * Number(weights[firstKey])) / otherTotal)
      : Math.floor(remaining / 2)

  return {
    ...weights,
    [key]: clamped,
    [firstKey]: first,
    [secondKey]: remaining - first,
  }
}

export function metShare(counts: FitRequirementCounts): number | null {
  if (!counts.total) {
    return null
  }

  return (counts.full + counts.partial * 0.5) / counts.total
}

export function selectedShares(
  summary: FitSummary,
  selection: FitComparisonSelection,
): Record<FitWeightKey, number | null> {
  return {
    minimum: selection.minimum ? metShare(summary.minimum) : null,
    recommended: selection.recommended ? metShare(summary.recommended) : null,
    skills: selection.skills ? metShare(summary.skills) : null,
  }
}

function presentKeys(summary: FitSummary, selection: FitComparisonSelection): FitWeightKey[] {
  return FIT_WEIGHT_KEYS.filter((key) => selection[key] && summary[key].total > 0)
}

export function effectiveWeights(
  weights: FitWeights,
  summary: FitSummary,
  selection: FitComparisonSelection,
): Record<FitWeightKey, number> {
  const keys = presentKeys(summary, selection)
  const total = keys.reduce((sum, key) => sum + Number(weights[key]), 0)
  const result: Record<FitWeightKey, number> = { minimum: 0, recommended: 0, skills: 0 }

  if (!keys.length) {
    return result
  }

  if (total <= 0) {
    for (const key of keys) {
      result[key] = 1 / keys.length
    }

    return result
  }

  for (const key of keys) {
    result[key] = Number(weights[key]) / total
  }

  return result
}

export function weightedFitScore(
  summary: FitSummary,
  weights: FitWeights,
  selection: FitComparisonSelection,
): number | null {
  const keys = presentKeys(summary, selection)

  if (!keys.length) {
    return null
  }

  const effective = effectiveWeights(weights, summary, selection)
  const score = keys.reduce((sum, key) => {
    const share = metShare(summary[key])

    return sum + effective[key] * (share ?? 0)
  }, 0)

  return score * 100
}

export function minimumTier(summary: FitSummary): 0 | 1 {
  return summary.minimum.none > 0 ? 1 : 0
}

function compareFallback(left: FitComparisonRow, right: FitComparisonRow): number {
  const summary = compareFitSummaries(left.summary, right.summary)

  if (summary !== 0) {
    return summary
  }

  return left.name.localeCompare(right.name)
}

function compareDefaultRows(
  left: FitComparisonRow,
  right: FitComparisonRow,
  selection: FitComparisonSelection,
): number {
  if (left.comparable !== right.comparable) {
    return left.comparable ? -1 : 1
  }

  if (left.tier !== right.tier) {
    return left.tier - right.tier
  }

  for (const key of FIT_WEIGHT_KEYS) {
    if (!selection[key]) {
      continue
    }

    const leftShare = left.shares[key] ?? 0
    const rightShare = right.shares[key] ?? 0

    if (leftShare !== rightShare) {
      return rightShare - leftShare
    }
  }

  return compareFallback(left, right)
}

function compareCustomRows(left: FitComparisonRow, right: FitComparisonRow): number {
  if (left.comparable !== right.comparable) {
    return left.comparable ? -1 : 1
  }

  if (left.total !== right.total) {
    if (left.total === null) {
      return 1
    }

    if (right.total === null) {
      return -1
    }

    return right.total - left.total
  }

  return compareFallback(left, right)
}

export function compareFitComparisonRows(
  left: FitComparisonRow,
  right: FitComparisonRow,
  options: FitComparisonOptions,
): number {
  return options.mode === 'default'
    ? compareDefaultRows(left, right, options.selection)
    : compareCustomRows(left, right)
}

export function buildFitComparison(
  entries: FitComparisonEntry[],
  options: FitComparisonOptions,
): FitComparisonRow[] {
  const rows = entries.map((entry) => {
    const comparable = FIT_WEIGHT_KEYS.some(
      (key) => options.selection[key] && entry.summary[key].total > 0,
    )

    return {
      ...entry,
      shares: selectedShares(entry.summary, options.selection),
      total:
        options.mode === 'custom'
          ? weightedFitScore(entry.summary, options.weights, options.selection)
          : null,
      tier: minimumTier(entry.summary),
      comparable,
    }
  })

  return [...rows].sort((left, right) => compareFitComparisonRows(left, right, options))
}
