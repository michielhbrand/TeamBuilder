import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FIT_WEIGHTS,
  DEFAULT_FIT_SELECTION,
  buildFitComparison,
  metShare,
  minimumTier,
  parseFitWeights,
  rebalanceWeights,
  weightedFitScore,
  type FitComparisonEntry,
} from '@/lib/fit-compare'
import { fitSummary } from '@/lib/fit-rank'
import type {
  FitAnalysisResult,
  FitRequirementAssessment,
  FitRequirementKind,
  FitRequirementStatus,
} from '@/types/fit'

function items(
  kind: FitRequirementKind,
  counts: Partial<Record<FitRequirementStatus, number>>,
): FitRequirementAssessment[] {
  const result: FitRequirementAssessment[] = []

  for (const status of ['full', 'partial', 'none'] as const) {
    for (let index = 0; index < (counts[status] ?? 0); index += 1) {
      result.push({
        id: `${kind}-${result.length + 1}`,
        kind,
        label: `${kind} ${status} ${index + 1}`,
        status,
        evidence: '',
        assessed: true,
      })
    }
  }

  return result
}

function result(
  minimum: Partial<Record<FitRequirementStatus, number>>,
  recommended: Partial<Record<FitRequirementStatus, number>> = {},
  skills: Partial<Record<FitRequirementStatus, number>> = {},
): FitAnalysisResult {
  return {
    schemaVersion: 3,
    complete: true,
    requirements: {
      minimum: items('minimum', minimum),
      recommended: items('recommended', recommended),
      skills: items('skill', skills),
    },
    similarities: [],
    gaps: [],
  }
}

function entry(
  applicantId: string,
  minimum: Partial<Record<FitRequirementStatus, number>>,
  recommended: Partial<Record<FitRequirementStatus, number>> = {},
  skills: Partial<Record<FitRequirementStatus, number>> = {},
): FitComparisonEntry {
  return {
    applicantId,
    name: applicantId,
    stageName: 'Screening',
    summary: fitSummary(result(minimum, recommended, skills)),
  }
}

describe('metShare', () => {
  it('counts partial compliance at half', () => {
    expect(metShare({ full: 2, partial: 1, none: 1, total: 4 })).toBe(0.625)
  })

  it('returns null when the group has no requirements', () => {
    expect(metShare({ full: 0, partial: 0, none: 0, total: 0 })).toBeNull()
  })
})

describe('parseFitWeights', () => {
  it('accepts weights that total 100', () => {
    expect(parseFitWeights({ minimum: 40, recommended: 40, skills: 20 })).toEqual({
      minimum: 40,
      recommended: 40,
      skills: 20,
    })
  })

  it('falls back to defaults for missing or invalid weights', () => {
    expect(parseFitWeights(undefined)).toEqual(DEFAULT_FIT_WEIGHTS)
    expect(parseFitWeights({ minimum: 50, recommended: 30, skills: 30 })).toEqual(
      DEFAULT_FIT_WEIGHTS,
    )
    expect(parseFitWeights({ minimum: '50', recommended: 30, skills: 20 })).toEqual(
      DEFAULT_FIT_WEIGHTS,
    )
  })
})

describe('rebalanceWeights', () => {
  it('keeps the total at 100 and redistributes the other two proportionally', () => {
    expect(rebalanceWeights(DEFAULT_FIT_WEIGHTS, 'minimum', 60)).toEqual({
      minimum: 60,
      recommended: 24,
      skills: 16,
    })
  })

  it('splits the remainder equally when the other two are zero', () => {
    expect(rebalanceWeights({ minimum: 0, recommended: 0, skills: 0 }, 'minimum', 40)).toEqual({
      minimum: 40,
      recommended: 30,
      skills: 30,
    })
  })

  it('can move one weight to 100', () => {
    expect(rebalanceWeights(DEFAULT_FIT_WEIGHTS, 'recommended', 100)).toEqual({
      minimum: 0,
      recommended: 100,
      skills: 0,
    })
  })

  it('keeps a zero weight at zero when the other has a value', () => {
    expect(rebalanceWeights({ minimum: 50, recommended: 50, skills: 0 }, 'minimum', 40)).toEqual({
      minimum: 40,
      recommended: 60,
      skills: 0,
    })
  })
})

describe('weightedFitScore', () => {
  it('weights each group met-share', () => {
    const summary = fitSummary(result({ full: 1 }, { full: 1, none: 1 }, { full: 1 }))

    expect(weightedFitScore(summary, DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_SELECTION)).toBeCloseTo(85)
  })

  it('renormalizes over groups that have requirements', () => {
    const summary = fitSummary(result({ full: 2 }))

    expect(weightedFitScore(summary, DEFAULT_FIT_WEIGHTS, DEFAULT_FIT_SELECTION)).toBe(100)
  })

  it('drops unselected groups from the total', () => {
    const summary = fitSummary(result({ full: 1 }, { full: 1, none: 1 }, { full: 1 }))
    const selection = { ...DEFAULT_FIT_SELECTION, skills: false }

    expect(weightedFitScore(summary, DEFAULT_FIT_WEIGHTS, selection)).toBeCloseTo(81.25)
  })

  it('uses equal weights when every selected group has a zero weight', () => {
    const summary = fitSummary(result({ full: 1 }, { full: 1, none: 1 }))
    const weights = { minimum: 0, recommended: 0, skills: 100 }

    expect(weightedFitScore(summary, weights, DEFAULT_FIT_SELECTION)).toBeCloseTo(75)
  })

  it('returns null when no selected group has requirements', () => {
    const summary = fitSummary(result({ full: 1 }))
    const selection = { minimum: false, recommended: true, skills: true }

    expect(weightedFitScore(summary, DEFAULT_FIT_WEIGHTS, selection)).toBeNull()
  })
})

describe('minimumTier', () => {
  it('is tier one only when a minimum is missed', () => {
    expect(minimumTier(fitSummary(result({ full: 1, none: 1 })))).toBe(1)
    expect(minimumTier(fitSummary(result({ full: 1, partial: 1 })))).toBe(0)
    expect(minimumTier(fitSummary(result({}, { none: 2 })))).toBe(0)
  })
})

describe('buildFitComparison', () => {
  it('default keeps the gate and then compares minimum, recommended, then skills', () => {
    const minHigh = entry('min-high', { full: 1 }, { none: 1 }, { none: 1 })
    const minLowRecHigh = entry('min-low-rec-high', { partial: 1 }, { full: 1 }, { none: 1 })
    const minLowRecLowSkillsHigh = entry(
      'min-low-rec-low-skills-high',
      { partial: 1 },
      { partial: 1 },
      { full: 1 },
    )
    const minLowRecLowSkillsLow = entry(
      'min-low-rec-low-skills-low',
      { partial: 1 },
      { partial: 1 },
      { none: 1 },
    )

    const rows = buildFitComparison(
      [minLowRecLowSkillsLow, minLowRecLowSkillsHigh, minLowRecHigh, minHigh],
      {
        mode: 'default',
        weights: DEFAULT_FIT_WEIGHTS,
        selection: DEFAULT_FIT_SELECTION,
      },
    )

    expect(rows.map((row) => row.applicantId)).toEqual([
      'min-high',
      'min-low-rec-high',
      'min-low-rec-low-skills-high',
      'min-low-rec-low-skills-low',
    ])
    expect(rows.every((row) => row.total === null)).toBe(true)
    expect(rows.every((row) => row.comparable)).toBe(true)
  })

  it('default keeps the gate when the minimum bar is unselected', () => {
    const allMinimums = entry('all-minimums', { full: 1 }, { none: 1 })
    const minimumMiss = entry('minimum-miss', { full: 1, none: 1 }, { full: 1 })
    const selection = { ...DEFAULT_FIT_SELECTION, minimum: false }

    const rows = buildFitComparison([minimumMiss, allMinimums], {
      mode: 'default',
      weights: DEFAULT_FIT_WEIGHTS,
      selection,
    })

    expect(rows.map((row) => row.applicantId)).toEqual(['all-minimums', 'minimum-miss'])
  })

  it('default skips hidden groups in the order', () => {
    const minHigh = entry('min-high', { full: 1 }, { none: 1 })
    const recHigh = entry('rec-high', { partial: 1 }, { full: 1 })
    const selection = { ...DEFAULT_FIT_SELECTION, minimum: false }

    const rows = buildFitComparison([minHigh, recHigh], {
      mode: 'default',
      weights: DEFAULT_FIT_WEIGHTS,
      selection,
    })

    expect(rows.map((row) => row.applicantId)).toEqual(['rec-high', 'min-high'])
  })

  it('custom weights ignores the minimum gate', () => {
    const noMiss = entry('no-miss', { partial: 1 }, { none: 1 }, { none: 1 })
    const minimumMiss = entry('minimum-miss', { full: 4, none: 1 }, { full: 1 }, { full: 1 })

    const rows = buildFitComparison([noMiss, minimumMiss], {
      mode: 'custom',
      weights: DEFAULT_FIT_WEIGHTS,
      selection: DEFAULT_FIT_SELECTION,
    })

    expect(rows.map((row) => row.applicantId)).toEqual(['minimum-miss', 'no-miss'])
    expect(rows[0]?.total).toBeCloseTo(90)
  })

  it('custom weights orders by weighted total then the shared key', () => {
    const strong = entry('strong', { full: 1 }, { full: 1 })
    const weak = entry('weak', { full: 1 }, { none: 1 })
    const same = entry('same', { full: 1 }, { full: 1 })

    const rows = buildFitComparison([weak, strong, same], {
      mode: 'custom',
      weights: DEFAULT_FIT_WEIGHTS,
      selection: DEFAULT_FIT_SELECTION,
    })

    expect(rows.map((row) => row.applicantId)).toEqual(['same', 'strong', 'weak'])
  })

  it('sorts candidates without a selected group last in both modes', () => {
    const comparable = entry('comparable', { full: 1 })
    const notComparable = entry('not-comparable', {}, { full: 1 })
    const selection = { minimum: true, recommended: false, skills: false }

    for (const mode of ['default', 'custom'] as const) {
      const rows = buildFitComparison([notComparable, comparable], {
        mode,
        weights: DEFAULT_FIT_WEIGHTS,
        selection,
      })

      expect(rows[0]?.applicantId).toBe('comparable')
      expect(rows[1]?.comparable).toBe(false)
      expect(rows[1]?.total).toBeNull()
    }
  })
})
