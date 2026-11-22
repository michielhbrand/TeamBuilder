import { describe, expect, it } from 'vitest'
import {
  toRequirementSet,
  validateRequirementExtraction,
} from '../../supabase/functions/fit-analysis/requirements'
import { validateAssessmentResult } from '../../supabase/functions/fit-analysis/assess'
import { ModelResultError } from '../../supabase/functions/fit-analysis/validate'

const requirementSet = toRequirementSet({
  minimum: ['Five years of TypeScript', 'Experience with React'],
  recommended: ['Kubernetes experience'],
  skills: ['TypeScript', 'Figma'],
})

describe('validateRequirementExtraction', () => {
  it('normalizes and deduplicates requirements across kinds', () => {
    const result = validateRequirementExtraction(
      JSON.stringify({
        minimum: ['  Five years of TypeScript  ', 'Five years of TypeScript'],
        recommended: ['Kubernetes experience'],
        skills: ['TypeScript', 'Figma'],
      }),
    )

    expect(result.minimum).toEqual(['Five years of TypeScript'])
    expect(result.recommended).toEqual(['Kubernetes experience'])
    expect(result.skills).toEqual(['Figma'])
  })

  it('accepts a job spec with no requirement sections', () => {
    const result = validateRequirementExtraction(
      JSON.stringify({ minimum: [], recommended: [], skills: [] }),
    )

    expect(result).toEqual({ minimum: [], recommended: [], skills: [] })
  })

  it('rejects malformed JSON', () => {
    expect(() => validateRequirementExtraction('not json')).toThrow(ModelResultError)
  })
})

describe('toRequirementSet', () => {
  it('assigns stable ids per kind', () => {
    expect(requirementSet.minimum.map((item) => item.id)).toEqual(['minimum-1', 'minimum-2'])
    expect(requirementSet.recommended[0]?.id).toBe('recommended-1')
    expect(requirementSet.skills[0]?.id).toBe('skill-1')
  })
})

describe('validateAssessmentResult', () => {
  it('groups assessments, derives summaries, and marks a complete result', () => {
    const result = validateAssessmentResult(
      JSON.stringify({
        assessments: [
          { id: 'minimum-1', status: 'full', evidence: 'Five years at Acme.' },
          { id: 'minimum-2', status: 'partial', evidence: 'Built some React screens.' },
          { id: 'recommended-1', status: 'none', evidence: '' },
          { id: 'skill-1', status: 'full', evidence: 'TypeScript listed.' },
          { id: 'skill-2', status: 'none', evidence: '' },
        ],
      }),
      requirementSet,
    )

    expect(result.complete).toBe(true)
    expect(result.requirements.minimum.map((item) => item.status)).toEqual(['full', 'partial'])
    expect(result.requirements.recommended[0]?.status).toBe('none')
    expect(result.requirements.skills.map((item) => item.assessed)).toEqual([true, true])
    expect(result.similarities).toEqual([
      'Five years of TypeScript: Five years at Acme.',
      'TypeScript: TypeScript listed.',
    ])
    expect(result.gaps).toEqual([
      'Kubernetes experience: no supporting evidence.',
      'Figma: no supporting evidence.',
    ])
  })

  it('marks missing requirement ids as not assessed', () => {
    const result = validateAssessmentResult(
      JSON.stringify({
        assessments: [{ id: 'minimum-1', status: 'full', evidence: 'Five years at Acme.' }],
      }),
      requirementSet,
    )

    expect(result.complete).toBe(false)
    expect(result.requirements.minimum[1]?.assessed).toBe(false)
    expect(result.requirements.recommended[0]?.assessed).toBe(false)
  })

  it('rejects a result with no valid assessments', () => {
    expect(() =>
      validateAssessmentResult(JSON.stringify({ assessments: [] }), requirementSet),
    ).toThrow(ModelResultError)
  })
})
