import type {
  FitAnalysis,
  FitAnalysisResult,
  FitRequirementAssessment,
  FitRequirementGroups,
} from '@/types/fit'

export interface FitRequirementCounts {
  full: number
  partial: number
  none: number
  total: number
}

export interface FitSummary {
  complete: boolean
  minimum: FitRequirementCounts
  recommended: FitRequirementCounts
  skills: FitRequirementCounts
  penalty: {
    minimum: number
    recommended: number
    skills: number
  }
}

export interface FitRankEntry {
  applicantId: string
  rank: number
  summary: FitSummary
}

function counts(items: FitRequirementAssessment[]): FitRequirementCounts {
  const result: FitRequirementCounts = { full: 0, partial: 0, none: 0, total: 0 }

  for (const item of items) {
    if (!item.assessed) {
      continue
    }

    result.total += 1

    if (item.status === 'full') {
      result.full += 1
    } else if (item.status === 'partial') {
      result.partial += 1
    } else {
      result.none += 1
    }
  }

  return result
}

function penalty(value: FitRequirementCounts): number {
  return value.none + value.partial * 0.5
}

function groups(result: FitAnalysisResult): FitRequirementGroups {
  return result.requirements
}

export function requirementTotal(result: FitAnalysisResult): number {
  const value = groups(result)

  return value.minimum.length + value.recommended.length + value.skills.length
}

export function fitSummary(result: FitAnalysisResult): FitSummary {
  const value = groups(result)
  const minimum = counts(value.minimum)
  const recommended = counts(value.recommended)
  const skills = counts(value.skills)

  return {
    complete: result.complete,
    minimum,
    recommended,
    skills,
    penalty: {
      minimum: penalty(minimum),
      recommended: penalty(recommended),
      skills: penalty(skills),
    },
  }
}

export function isRankable(analysis: FitAnalysis | undefined): analysis is FitAnalysis {
  return Boolean(analysis?.result.complete && requirementTotal(analysis.result) > 0)
}

function key(summary: FitSummary): number[] {
  return [
    summary.penalty.minimum,
    summary.minimum.none,
    summary.penalty.recommended,
    summary.recommended.none,
    summary.penalty.skills,
    summary.skills.none,
  ]
}

export function compareFitSummaries(left: FitSummary, right: FitSummary): number {
  const leftKey = key(left)
  const rightKey = key(right)

  for (let index = 0; index < leftKey.length; index += 1) {
    const leftValue = leftKey[index]!
    const rightValue = rightKey[index]!

    if (leftValue !== rightValue) {
      return leftValue - rightValue
    }
  }

  return 0
}

export function compareFitAnalyses(
  left: FitAnalysis | undefined,
  right: FitAnalysis | undefined,
): number {
  const leftRankable = isRankable(left)
  const rightRankable = isRankable(right)

  if (!leftRankable && !rightRankable) {
    return 0
  }

  if (!leftRankable) {
    return 1
  }

  if (!rightRankable) {
    return -1
  }

  return compareFitSummaries(fitSummary(left.result), fitSummary(right.result))
}

export function rankFitAnalyses(analyses: FitAnalysis[]): Map<string, FitRankEntry> {
  const rankable = analyses.filter(isRankable)
  const sorted = [...rankable].sort((left, right) => compareFitAnalyses(left, right))
  const ranked = new Map<string, FitRankEntry>()

  sorted.forEach((analysis, index) => {
    ranked.set(analysis.applicantId, {
      applicantId: analysis.applicantId,
      rank: index + 1,
      summary: fitSummary(analysis.result),
    })
  })

  return ranked
}
