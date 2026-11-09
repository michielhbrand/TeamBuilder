import { describe, expect, it } from 'vitest'
import {
  extractApplicantDraft,
  mergeApplicantDraft,
  missingKeyFields,
  type ApplicantDraft,
  type ApplicantDraftField,
} from '@/lib/resume-import'

const CV = `
AMARA OKAFOR
Product Designer
amara@example.com | +1 555 010 2000 | linkedin.com/in/amara

Summary
Designer focused on complex operational tools.

Experience
Senior Product Designer at Northwind 2021 - Present
Led the design system and hiring workspace.

Education
BSc Interaction Design, University of Cape Town 2014 - 2018

Skills
Figma, TypeScript, research
`

describe('resume import', () => {
  it('extracts contact details, name, role, and sections from CV text', () => {
    const draft = extractApplicantDraft(CV, 'amara-okafo-cv.pdf')

    expect(draft.name).toBe('Amara Okafor')
    expect(draft.email).toBe('amara@example.com')
    expect(draft.phone).toBe('15550102000')
    expect(draft.currentRole).toContain('Senior Product Designer')
    expect(draft.experience).toContain('Led the design system')
    expect(draft.education).toContain('BSc Interaction Design')
    expect(draft.education).not.toContain('Figma')
  })

  it('normalizes name and email casing', () => {
    const draft = extractApplicantDraft(
      "JANE O'CONNOR\nJANE.DOE@EXAMPLE.COM\nPhone: +1 555 010 2000",
    )

    expect(draft.name).toBe("Jane O'Connor")
    expect(draft.email).toBe('jane.doe@example.com')
  })

  it('formats education into title, dates, and details without achievements', () => {
    const draft = extractApplicantDraft(`
EDUCATION
M.S. Software Engineering
Quantic School of Business & Technology
z 2025 – ongoing
Web Application and Interface Design, Design and
Architecture, Testing and CI/CD, Cloud Applications
and Architectures, Machine Learning, AI Engineer-
ing, Microservices, Blockchain, Data, Statistics.
M.Eng. Electronic Engineering
Stellenbosch University
z 2020 – 2023
Dissertation: Towards the development of a smartphone-
based biosensor for detecting Tuberculosis.
B.Eng. Electrical and Electronic Engineering
(Robotics)
Stellenbosch University
z 2014 – 2019
Machine Learning, Computer Systems, Systems &
Signals, Control Systems, Electronics, Electronic De-
sign - Digital & Analogue Systems.
ACHIEVEMENTS
Commercial Pilot License
Private Pilot License
`)

    expect(draft.education).toContain("Highest qualification: Master's degree")
    expect(draft.education).toContain('M.S. Software Engineering\n2025 – Ongoing')
    expect(draft.education).toContain('Quantic School of Business & Technology')
    expect(draft.education).toContain('\n\nM.Eng. Electronic Engineering\n2020 – 2023')
    expect(draft.education).toContain(
      'B.Eng. Electrical and Electronic Engineering (Robotics)\n2014 – 2019',
    )
    expect(draft.education).toContain('3 qualifications')
    expect(draft.education).not.toContain('ACHIEVEMENTS')
    expect(draft.education).not.toContain('Commercial Pilot License')
  })

  it('formats experience into title, dates, details and totals years', () => {
    const draft = extractApplicantDraft(`
EXPERIENCE
Senior Product Designer, Acme
2019 – 2021
Led the design system.
Product Designer, Beta
2021 – 2023
Built the hiring workspace.
`)

    expect(draft.experience).toContain('Industry experience: 4 years across 2 roles')
    expect(draft.experience).toContain(
      'Senior Product Designer, Acme\n2019 – 2021\nLed the design system.',
    )
    expect(draft.experience).toContain(
      '\n\nProduct Designer, Beta\n2021 – 2023\nBuilt the hiring workspace.',
    )
    expect(draft.currentRole).toBe('Senior Product Designer, Acme')
  })

  it('removes trailing separators from an experience role line', () => {
    const draft = extractApplicantDraft(
      'Jane Doe\njane@example.com\nExperience\nSenior Product Designer, Acme, 2022 - Present',
    )

    expect(draft.currentRole).toBe('Senior Product Designer, Acme')
  })

  it('falls back to the filename when no name line is present', () => {
    const draft = extractApplicantDraft('Contact: person@example.com', 'jane_doe_cv.pdf')

    expect(draft.name).toBe('Jane Doe')
  })

  it('does not treat a date range as a phone number', () => {
    const draft = extractApplicantDraft('Experience\n2019 - 2021\nAnalyst')

    expect(draft.phone).toBe('')
  })

  it('recognizes labelled phone numbers and normalizes them', () => {
    const draft = extractApplicantDraft('Phone: +44 (0)20 7946 0958\nName: Alex Kim')

    expect(draft.phone).toBe('4402079460958')
  })

  it('reports missing key fields', () => {
    expect(missingKeyFields(extractApplicantDraft('Engineer'))).toBe(true)
    expect(
      missingKeyFields(
        extractApplicantDraft('Jane Doe\njane@example.com\nWork experience\nEngineer'),
      ),
    ).toBe(false)
  })
})

describe('applicant draft merge', () => {
  function draft(overrides: Partial<ApplicantDraft> = {}): ApplicantDraft {
    return {
      name: '',
      email: '',
      phone: '',
      currentRole: '',
      education: '',
      experience: '',
      ...overrides,
    }
  }

  function form(): Record<ApplicantDraftField, string> {
    return {
      name: '',
      email: '',
      phone: '',
      currentRole: '',
      education: '',
      experience: '',
    }
  }

  it('fills empty fields and marks them as auto-filled', () => {
    const values = form()
    const autoFilled = new Set<ApplicantDraftField>()

    mergeApplicantDraft(
      values,
      draft({ name: 'Jane Doe', email: 'jane@example.com' }),
      new Set(),
      autoFilled,
    )

    expect(values.name).toBe('Jane Doe')
    expect(values.email).toBe('jane@example.com')
    expect(autoFilled.has('name')).toBe(true)
  })

  it('updates prior auto-filled values but keeps manual edits', () => {
    const values = form()
    const autoFilled = new Set<ApplicantDraftField>(['name'])
    const edited = new Set<ApplicantDraftField>()

    values.name = 'Jane Doe'
    values.email = 'typed@example.com'
    edited.add('email')

    mergeApplicantDraft(
      values,
      draft({ name: 'Jane D.', email: 'other@example.com' }),
      edited,
      autoFilled,
    )

    expect(values.name).toBe('Jane D.')
    expect(values.email).toBe('typed@example.com')
    expect(autoFilled.has('email')).toBe(false)
  })

  it('does not overwrite a manual value that was never auto-filled', () => {
    const values = form()
    const autoFilled = new Set<ApplicantDraftField>()

    values.name = 'Manual Name'

    mergeApplicantDraft(values, draft({ name: 'Jane Doe' }), new Set(), autoFilled)

    expect(values.name).toBe('Manual Name')
    expect(autoFilled.has('name')).toBe(false)
  })
})
