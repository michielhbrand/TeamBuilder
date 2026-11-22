import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import CandidateCard from '@/components/CandidateCard.vue'
import type { Board, Candidate } from '@/types/pipeline'

const day = 24 * 60 * 60 * 1000

const steps = [
  { id: 'applied', name: 'Applied', position: 0 },
  { id: 'screening', name: 'Screening', position: 1 },
  { id: 'offer', name: 'Offer', position: 2 },
]

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    boardId: 'b1',
    name: 'Zanele Khumalo',
    email: 'zanele@example.com',
    phone: '',
    currentRole: 'Software engineer',
    remChannel: '',
    salaryBand: '',
    noticePeriodMonths: 0,
    salaryExpectationCents: 0,
    favorite: false,
    stepId: 'screening',
    status: 'active',
    appliedAt: new Date(Date.now() - 20 * day).toISOString(),
    stepEnteredAt: new Date(Date.now() - 12 * day).toISOString(),
    education: [],
    experience: [],
    skills: [],
    ...overrides,
  }
}

function board(item: Candidate): Board {
  return {
    id: 'b1',
    name: 'Senior Frontend Engineer',
    department: 'Engineering',
    openPositions: 2,
    deadline: '2026-12-01',
    openedAt: '2026-01-01T00:00:00.000Z',
    steps,
    candidates: [item],
  }
}

function mountCard(overrides: Partial<Candidate> = {}) {
  const item = candidate(overrides)
  return mount(CandidateCard, {
    props: { board: board(item), candidate: item },
    global: { plugins: [createVuetify()] },
    attachTo: document.body,
  })
}

const interactive = 'button, a[href], input, select, textarea, [role="button"], [tabindex]'

describe('CandidateCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('the card root is not a button', () => {
    const wrapper = mountCard()
    const root = wrapper.element as HTMLElement

    expect(root.tagName).toBe('ARTICLE')
    expect(root.getAttribute('role')).not.toBe('button')
    expect(root.hasAttribute('tabindex')).toBe(false)
  })

  it('no interactive element is nested inside another', () => {
    const wrapper = mountCard()
    const controls = Array.from(
      (wrapper.element as HTMLElement).querySelectorAll<HTMLElement>(interactive),
    )

    expect(controls.length).toBeGreaterThan(0)
    const nested = controls.filter((control) => control.parentElement?.closest(interactive))
    expect(nested.map((control) => control.outerHTML)).toEqual([])
  })

  it('the name button is labelled "Open profile for <name>"', async () => {
    const wrapper = mountCard()
    const button = wrapper.get('button[aria-label="Open profile for Zanele Khumalo"]')

    expect(button.text()).toContain('Zanele Khumalo')
    await button.trigger('click')
    expect(wrapper.emitted('open-profile')).toHaveLength(1)
  })

  it('first-stage cards have no Move back button and last-stage cards have no Move forward button', () => {
    const first = mountCard({ stepId: 'applied' })
    expect(first.find('[aria-label^="Move Zanele Khumalo back"]').exists()).toBe(false)
    expect(first.find('[aria-label="Move Zanele Khumalo forward to Screening"]').exists()).toBe(
      true,
    )

    const last = mountCard({ stepId: 'offer' })
    expect(last.find('[aria-label^="Move Zanele Khumalo forward"]').exists()).toBe(false)
    expect(last.find('[aria-label="Move Zanele Khumalo back to Screening"]').exists()).toBe(true)
  })

  it('the card shows "N days in stage" and no "applied N days ago" text', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('12 days in stage')
    expect(wrapper.text()).not.toMatch(/applied/i)
  })

  it('Hire and Reject are not rendered on the resting card', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).not.toContain('Hire')
    expect(wrapper.text()).not.toContain('Reject')
    expect(wrapper.find('[aria-label="More actions for Zanele Khumalo"]').exists()).toBe(true)
  })
})
