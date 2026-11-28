import { compareFitSummaries, type FitRequirementCounts, type FitSummary } from '@/lib/fit-rank'
import type { FitWeightKey, FitWeights } from '@/types/fit'

export type FitComparisonMode = 'weighted' | 'unweighted'

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

export function unweightedFitScore(
  summary: FitSummary,
  selection: FitComparisonSelection,
): number | null {
  const keys = presentKeys(summary, selection)

  if (!keys.length) {
    return null
  }

  const score = keys.reduce((sum, key) => sum + (metShare(summary[key]) ?? 0), 0)

  return (score / keys.length) * 100
}

export function minimumTier(summary: FitSummary): 0 | 1 {
  return summary.minimum.none > 0 ? 1 : 0
}

export function compareFitComparisonRows(left: FitComparisonRow, right: FitComparisonRow): number {
  if (left.tier !== right.tier) {
    return left.tier - right.tier
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

  const summary = compareFitSummaries(left.summary, right.summary)

  if (summary !== 0) {
    return summary
  }

  return left.name.localeCompare(right.name)
}

export function buildFitComparison(
  entries: FitComparisonEntry[],
  options: FitComparisonOptions,
): FitComparisonRow[] {
  const rows = entries.map((entry) => {
    const total =
      options.mode === 'weighted'
        ? weightedFitScore(entry.summary, options.weights, options.selection)
        : unweightedFitScore(entry.summary, options.selection)

    return {
      ...entry,
      shares: selectedShares(entry.summary, options.selection),
      total,
      tier: minimumTier(entry.summary),
      comparable: total !== null,
    }
  })

  return [...rows].sort(compareFitComparisonRows)
}
