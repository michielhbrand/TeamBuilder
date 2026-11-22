import type { FitSummary } from '@/lib/fit-rank'
import type { FitRequirementAssessment } from '@/types/fit'

export function requirementStatusText(item: FitRequirementAssessment): string {
  if (!item.assessed) {
    return 'Not assessed'
  }

  if (item.status === 'full') {
    return 'Fully met'
  }

  if (item.status === 'partial') {
    return 'Partly met'
  }

  return 'Not shown in CV'
}

export function verdictTitle(summary: FitSummary): string {
  const noun = (total: number, prefix = ''): string =>
    `${prefix}${total === 1 ? 'requirement' : 'requirements'}`

  if (summary.minimum.total) {
    return `${summary.minimum.full} of ${summary.minimum.total} ${noun(summary.minimum.total, 'minimum ')} met`
  }

  const total = summary.recommended.total + summary.skills.total
  const full = summary.recommended.full + summary.skills.full

  return total ? `${full} of ${total} ${noun(total)} met` : ''
}
