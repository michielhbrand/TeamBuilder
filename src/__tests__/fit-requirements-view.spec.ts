import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import FitRequirements from '@/components/FitRequirements.vue'
import { fitSummary } from '@/lib/fit-rank'
import { requirementStatusText, verdictTitle } from '@/lib/fit-view'
import type {
  FitAnalysisResult,
  FitRequirementAssessment,
  FitRequirementKind,
  FitRequirementStatus,
} from '@/types/fit'

function item(
  id: string,
  kind: FitRequirementKind,
  status: FitRequirementStatus,
  overrides: Partial<FitRequirementAssessment> = {},
): FitRequirementAssessment {
  return {
    id,
    kind,
    label: `Label ${id}`,
    status,
    evidence: status === 'none' ? '' : `Evidence ${id}`,
    assessed: true,
    ...overrides,
  }
}

function result(overrides: Partial<FitAnalysisResult['requirements']> = {}): FitAnalysisResult {
  return {
    schemaVersion: 3,
    complete: true,
    requirements: {
      minimum: [item('m1', 'minimum', 'full'), item('m2', 'minimum', 'none')],
      recommended: [item('r1', 'recommended', 'partial'), item('r2', 'recommended', 'none')],
      skills: [item('s1', 'skill', 'full')],
      ...overrides,
    },
    similarities: [],
    gaps: [],
  }
}

function mountView(
  value: FitAnalysisResult,
  rank?: { position: number; total: number; stageName: string },
) {
  return mount(FitRequirements, {
    props: { result: value, rank },
    global: { plugins: [createVuetify()] },
  })
}

describe('verdictTitle', () => {
  it('leads with the minimum requirements', () => {
    expect(verdictTitle(fitSummary(result()))).toBe('1 of 2 minimum requirements met')
  })

  it('uses the singular for one minimum requirement', () => {
    const value = result({ minimum: [item('m1', 'minimum', 'full')] })

    expect(verdictTitle(fitSummary(value))).toBe('1 of 1 minimum requirement met')
  })

  it('falls back to all requirements when the spec has no minimum section', () => {
    const value = result({ minimum: [] })

    expect(verdictTitle(fitSummary(value))).toBe('1 of 3 requirements met')
  })
})

describe('requirementStatusText', () => {
  it('words the statuses for people and screen readers', () => {
    expect(requirementStatusText(item('a', 'minimum', 'full'))).toBe('Fully met')
    expect(requirementStatusText(item('a', 'minimum', 'partial'))).toBe('Partly met')
    expect(requirementStatusText(item('a', 'minimum', 'none'))).toBe('Not shown in CV')
    expect(requirementStatusText(item('a', 'minimum', 'none', { assessed: false }))).toBe(
      'Not assessed',
    )
  })
})

describe('FitRequirements', () => {
  it('states the verdict, the counts and the rank', () => {
    const wrapper = mountView(result(), { position: 3, total: 12, stageName: 'Screening' })

    expect(wrapper.text()).toContain('1 of 2 minimum requirements met')
    expect(wrapper.text()).toContain('Ranked #3 of 12 analyzed in Screening')
    expect(wrapper.text()).toContain('1 not shown')
    expect(wrapper.text()).toContain('1 partial')
  })

  it('omits the rank line when the applicant is not ranked', () => {
    expect(mountView(result()).text()).not.toContain('Ranked #')
  })

  it('labels the bars for assistive technology', () => {
    const labels = mountView(result())
      .findAll('[role="img"]')
      .map((node) => node.attributes('aria-label'))

    expect(labels).toContain('Minimum: 1 of 2 met, 1 not shown')
  })

  it('explains a missing requirement instead of printing "None"', () => {
    const text = mountView(result()).text()

    expect(text).toContain('Not found in the CV')
    expect(text).not.toMatch(/\bNone\b/)
  })

  it('treats only a missing minimum requirement as critical', () => {
    const wrapper = mountView(result())
    const critical = wrapper.findAll('.fit-absent--critical')

    expect(critical).toHaveLength(1)
    expect(critical[0]!.element.closest('section')!.textContent).toContain('Label m2')
  })

  it('quotes evidence and marks a partial match', () => {
    const wrapper = mountView(result())

    expect(wrapper.find('.fit-evidence').text()).toContain('Evidence m1')
    expect(wrapper.text()).toContain('Partly met')
  })

  it('reads out each status for screen readers', () => {
    const labels = mountView(result()).findAll('.fit-row__label .sr-only')

    expect(labels.map((node) => node.text())).toEqual([
      'Fully met:',
      'Not shown in CV:',
      'Partly met:',
      'Not shown in CV:',
    ])
  })

  it('shows only gaps when asked', async () => {
    const wrapper = mountView(result())

    const toggle = wrapper.find('[role="switch"]')

    expect(toggle.attributes('aria-checked')).toBe('false')
    await toggle.trigger('click')

    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).not.toContain('Label m1')
    expect(wrapper.text()).toContain('Label m2')
    expect(wrapper.text()).toContain('Label r1')
  })

  it('collapses and reopens a group', async () => {
    const wrapper = mountView(result())
    const toggle = wrapper.find('[data-group="minimum"]')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('Label m1')
    await toggle.trigger('click')
    expect(wrapper.text()).toContain('Label m1')
  })

  it('shows skills as compact chips and hides empty groups', () => {
    const wrapper = mountView(result({ recommended: [] }))

    expect(wrapper.findAll('.fit-chip')).toHaveLength(1)
    expect(wrapper.find('[data-group="recommended"]').exists()).toBe(false)
  })

  it('marks requirements the model skipped as not assessed', () => {
    const wrapper = mountView(
      result({ minimum: [item('m1', 'minimum', 'none', { assessed: false })] }),
    )

    expect(wrapper.text()).toContain('Not assessed')
  })
})
