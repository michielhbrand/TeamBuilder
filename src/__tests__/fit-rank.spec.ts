import { describe, expect, it } from 'vitest'
import { compareFitAnalyses, fitSummary, isRankable, rankFitAnalyses } from '@/lib/fit-rank'
import type {
  FitAnalysis,
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

function analysis(
  applicantId: string,
  minimum: Partial<Record<FitRequirementStatus, number>>,
  recommended: Partial<Record<FitRequirementStatus, number>> = {},
  skills: Partial<Record<FitRequirementStatus, number>> = {},
  complete = true,
): FitAnalysis {
  return {
    id: `analysis-${applicantId}`,
    boardId: 'board-1',
    applicantId,
    cvFingerprint: 'cv',
    jobSpecFingerprint: 'spec',
    profileFingerprint: 'profile',
    provider: 'kilo',
    model: 'free',
    promptVersion: 'test',
    result: {
      schemaVersion: 3,
      complete,
      requirements: {
        minimum: items('minimum', minimum),
        recommended: items('recommended', recommended),
        skills: items('skill', skills),
      },
      similarities: [],
      gaps: [],
    },
    createdAt: '2026-11-21T00:00:00Z',
    updatedAt: '2026-11-21T00:00:00Z',
  }
}

describe('fitSummary', () => {
  it('counts statuses and weights partial compliance at half', () => {
    const summary = fitSummary(
      analysis('a', { full: 2, partial: 1, none: 1 }, { full: 1, none: 1 }).result,
    )

    expect(summary.minimum).toEqual({ full: 2, partial: 1, none: 1, total: 4 })
    expect(summary.penalty.minimum).toBe(1.5)
    expect(summary.penalty.recommended).toBe(1)
  })
})

describe('ranking', () => {
  it('ranks a candidate with no minimum misses above one minimum miss', () => {
    const recommendedMisses = analysis('recommended-misses', { full: 5 }, { none: 2 })
    const minimumMiss = analysis('minimum-miss', { none: 1 }, { full: 3 })

    expect(compareFitAnalyses(recommendedMisses, minimumMiss)).toBeLessThan(0)
    expect(compareFitAnalyses(minimumMiss, recommendedMisses)).toBeGreaterThan(0)
  })

  it('ranks fewer minimum misses above more minimum misses', () => {
    const oneMiss = analysis('one', { full: 4, none: 1 })
    const threeMisses = analysis('three', { full: 2, none: 3 })

    expect(compareFitAnalyses(oneMiss, threeMisses)).toBeLessThan(0)
  })

  it('ranks a partial minimum above a missed minimum', () => {
    const partial = analysis('partial', { partial: 1 })
    const missed = analysis('missed', { none: 1 })

    expect(compareFitAnalyses(partial, missed)).toBeLessThan(0)
  })

  it('uses recommended results only after minimum results tie', () => {
    const strongerRecommended = analysis('strong-rec', { full: 2 }, { full: 3 })
    const weakerRecommended = analysis('weak-rec', { full: 2 }, { none: 1 })

    expect(compareFitAnalyses(strongerRecommended, weakerRecommended)).toBeLessThan(0)
  })

  it('excludes incomplete and empty analyses from ranks', () => {
    const complete = analysis('complete', { full: 1 })
    const incomplete = analysis('incomplete', { full: 1 }, {}, {}, false)
    const empty = analysis('empty', {})

    expect(isRankable(complete)).toBe(true)
    expect(isRankable(incomplete)).toBe(false)
    expect(isRankable(empty)).toBe(false)

    const ranks = rankFitAnalyses([complete, incomplete, empty])

    expect(ranks.get('complete')?.rank).toBe(1)
    expect(ranks.has('incomplete')).toBe(false)
    expect(ranks.has('empty')).toBe(false)
  })
})
