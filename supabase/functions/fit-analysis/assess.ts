import { ModelResultError, parseJsonObject } from './validate.ts'
import {
  requirementItems,
  type RequirementItem,
  type RequirementKind,
  type RequirementSet,
} from './requirements.ts'

export type RequirementStatus = 'full' | 'partial' | 'none'

export interface RequirementAssessment {
  id: string
  kind: RequirementKind
  label: string
  status: RequirementStatus
  evidence: string
  assessed: boolean
}

export interface AssessmentGroups {
  minimum: RequirementAssessment[]
  recommended: RequirementAssessment[]
  skills: RequirementAssessment[]
}

export interface AssessmentResult {
  complete: boolean
  requirements: AssessmentGroups
  similarities: string[]
  gaps: string[]
}

const MAX_EVIDENCE_LENGTH = 150
const MAX_SUMMARY_ITEMS = 4

export const ASSESSMENT_SYSTEM_PROMPT = `Evaluate candidate against requirements.
Return JSON only. No markdown.

For each requirement id:
- "full": candidate clearly supports requirement
- "partial": candidate partially supports requirement
- "none": candidate does not support requirement

Rules:
- Assess each requirement independently
- Keep evidence under 15 words
- Use "none" with empty evidence if no support
- No requirement additions or removals
- No generic praise or recommendations

Return:
{
  "assessments": [
    { "id": "minimum-1", "status": "full", "evidence": "Evidence text" }
  ]
}`

export function buildAssessmentPrompt(input: {
  boardName: string
  department: string
  requirementSet: RequirementSet
  candidateText: string
}): string {
  return JSON.stringify(
    {
      role: {
        board: input.boardName,
        department: input.department,
      },
      requirements: {
        minimum: input.requirementSet.minimum.map((item) => ({
          id: item.id,
          label: item.label,
        })),
        recommended: input.requirementSet.recommended.map((item) => ({
          id: item.id,
          label: item.label,
        })),
        skills: input.requirementSet.skills.map((item) => ({
          id: item.id,
          label: item.label,
        })),
      },
      candidate: input.candidateText,
    },
    null,
    2,
  )
}

function normalizeStatus(value: unknown): RequirementStatus | null {
  if (typeof value !== 'string') {
    return null
  }

  const token = value.toLowerCase().replace(/[^a-z]/g, '')

  if (
    [
      'full',
      'fully',
      'fullycomply',
      'fullcompliance',
      'compliant',
      'complete',
      'meets',
      'met',
      'yes',
    ].includes(token)
  ) {
    return 'full'
  }

  if (
    ['partial', 'partially', 'partly', 'partialcompliance', 'partialcomply', 'some'].includes(token)
  ) {
    return 'partial'
  }

  if (
    ['none', 'no', 'zero', 'zerocompliance', 'notmet', 'missing', 'absent', 'noevidence'].includes(
      token,
    )
  ) {
    return 'none'
  }

  return null
}

function asEvidence(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_EVIDENCE_LENGTH) : ''
}

function assessmentMap(record: Record<string, unknown>): Map<string, RequirementAssessment> {
  const raw = Array.isArray(record.assessments)
    ? record.assessments
    : Array.isArray(record.requirements)
      ? record.requirements
      : []
  const map = new Map<string, RequirementAssessment>()

  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue
    }

    const entry = item as Record<string, unknown>
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    const status = normalizeStatus(entry.status ?? entry.compliance)

    if (!id || !status || map.has(id)) {
      continue
    }

    map.set(id, {
      id,
      kind: 'minimum',
      label: '',
      status,
      evidence: asEvidence(entry.evidence ?? entry.comment),
      assessed: true,
    })
  }

  return map
}

function group(
  items: RequirementItem[],
  assessed: Map<string, RequirementAssessment>,
): RequirementAssessment[] {
  return items.map((item) => {
    const result = assessed.get(item.id)

    return {
      id: item.id,
      kind: item.kind,
      label: item.label,
      status: result?.status ?? 'none',
      evidence: result?.evidence ?? '',
      assessed: Boolean(result),
    }
  })
}

function summaryItem(assessment: RequirementAssessment, fallback: string): string {
  return assessment.evidence
    ? `${assessment.label}: ${assessment.evidence}`
    : `${assessment.label}: ${fallback}`
}

export function validateAssessmentResult(
  content: string,
  requirementSet: RequirementSet,
): AssessmentResult {
  const record = parseJsonObject(content)
  const assessed = assessmentMap(record)
  const all = requirementItems(requirementSet)

  if (!all.some((item) => assessed.has(item.id))) {
    throw new ModelResultError('The model did not return any requirement assessments.')
  }

  const requirements: AssessmentGroups = {
    minimum: group(requirementSet.minimum, assessed),
    recommended: group(requirementSet.recommended, assessed),
    skills: group(requirementSet.skills, assessed),
  }
  const complete = all.every((item) => assessed.has(item.id))
  const ordered = [...requirements.minimum, ...requirements.recommended, ...requirements.skills]
  const similarities = ordered
    .filter((item) => item.assessed && item.status === 'full')
    .slice(0, MAX_SUMMARY_ITEMS)
    .map((item) => summaryItem(item, 'meets this requirement.'))
  const gaps = ordered
    .filter((item) => item.assessed && item.status === 'none')
    .slice(0, MAX_SUMMARY_ITEMS)
    .map((item) => summaryItem(item, 'no supporting evidence.'))

  return {
    complete,
    requirements,
    similarities,
    gaps,
  }
}
