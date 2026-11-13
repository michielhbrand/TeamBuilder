import { describe, expect, it } from 'vitest'
import {
  prepareCandidateText,
  prepareJobSpecText,
} from '../../supabase/functions/fit-analysis/redact'
import {
  ModelResultError,
  validateModelResult,
} from '../../supabase/functions/fit-analysis/validate'

const applicant = {
  full_name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  phone: '+27 82 123 4567',
}

describe('prepareCandidateText', () => {
  it('removes identity and sensitive fields while keeping employers and dates', () => {
    const text = prepareCandidateText(
      'BSc Computer Science\nUniversity of Cape Town\n2018 - 2021',
      [
        'Senior Engineer at Acme, 2021 - 2025.',
        'Built React and TypeScript systems.',
        'Managed Kubernetes clusters for internal teams.',
        'Thandi Mokoena',
        'thandi@example.com',
        '+27 82 123 4567',
        'Date of birth: 1990-01-01',
        'Nationality: South African',
        'https://example.com/thandi',
      ].join('\n'),
      applicant,
    )

    expect(text).toContain('University of Cape Town')
    expect(text).toContain('Acme')
    expect(text).toContain('2018 - 2021')
    expect(text).toContain('React and TypeScript')
    expect(text).toContain('Managed Kubernetes clusters')
    expect(text).not.toContain('Thandi')
    expect(text).not.toContain('Mokoena')
    expect(text).not.toContain('thandi@example.com')
    expect(text).not.toContain('82 123 4567')
    expect(text).not.toContain('1990-01-01')
    expect(text).not.toContain('South African')
    expect(text).not.toContain('example.com')
  })
})

describe('prepareJobSpecText', () => {
  it('normalizes whitespace and truncates long job specs', () => {
    const text = prepareJobSpecText(`Role\n\n\n${'A'.repeat(25_000)}`)

    expect(text.startsWith('Role\n\nA')).toBe(true)
    expect(text.length).toBe(20_000)
  })
})

describe('validateModelResult', () => {
  it('returns trimmed, deduplicated similarities and gaps', () => {
    const content = JSON.stringify({
      similarities: [
        '  React experience: built React and TypeScript systems.  ',
        'React experience: built React and TypeScript systems.',
        'Degree: BSc Computer Science.',
      ],
      gaps: [
        'Kubernetes: no evidence of cluster management.',
        'Kubernetes: no evidence of cluster management.',
      ],
    })

    const result = validateModelResult(content)

    expect(result.schemaVersion).toBe(2)
    expect(result.similarities).toEqual([
      'React experience: built React and TypeScript systems.',
      'Degree: BSc Computer Science.',
    ])
    expect(result.gaps).toEqual(['Kubernetes: no evidence of cluster management.'])
  })

  it('does not repeat a similarity as a gap', () => {
    const content = JSON.stringify({
      similarities: ['React experience: built React and TypeScript systems.'],
      gaps: [
        'React experience: built React and TypeScript systems.',
        'Kubernetes: no evidence of cluster management.',
      ],
    })

    const result = validateModelResult(content)

    expect(result.gaps).toEqual(['Kubernetes: no evidence of cluster management.'])
  })

  it('accepts legacy strengths as similarities', () => {
    const content = JSON.stringify({
      strengths: ['React and TypeScript experience'],
      gaps: ['No Kubernetes evidence'],
    })

    const result = validateModelResult(content)

    expect(result.similarities).toEqual(['React and TypeScript experience'])
    expect(result.gaps).toEqual(['No Kubernetes evidence'])
  })

  it('rejects malformed JSON', () => {
    expect(() => validateModelResult('not json')).toThrow(ModelResultError)
  })

  it('rejects a result without similarities or gaps', () => {
    expect(() => validateModelResult(JSON.stringify({ gaps: [] }))).toThrow(ModelResultError)
  })
})
