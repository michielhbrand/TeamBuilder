import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import ApplicantStageBar from '@/components/ApplicantStageBar.vue'
import { useApplicantsStore, type SaveStatus } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import type { Candidate } from '@/types/pipeline'

const steps = [
  { id: 'applied', name: 'Applied', position: 0 },
  { id: 'screening', name: 'Screening', position: 1 },
  { id: 'offer', name: 'Offer', position: 2 },
]

function seed(overrides: Partial<Candidate> = {}): void {
  const candidate: Candidate = {
    id: 'c1',
    boardId: 'b1',
    name: 'Zanele Khumalo',
    email: '',
    phone: '',
    currentRole: 'Software engineer',
    remChannel: '',
    salaryBand: '',
    noticePeriodMonths: 0,
    salaryExpectationCents: 0,
    favorite: false,
    stepId: 'screening',
    status: 'active',
    appliedAt: '2026-11-01T00:00:00.000Z',
    stepEnteredAt: '2026-11-05T00:00:00.000Z',
    education: [],
    experience: [],
    skills: [],
    ...overrides,
  }

  useBoardsStore().boards = [
    {
      id: 'b1',
      name: 'Senior Frontend Engineer',
      department: 'Engineering',
      openPositions: 1,
      deadline: '2026-12-01',
      openedAt: '2026-01-01T00:00:00.000Z',
      steps,
      candidates: [candidate],
    },
  ]
}

function mountBar(onRetry?: () => void) {
  return mount(ApplicantStageBar, {
    props: { candidateId: 'c1', onRetry },
    global: { plugins: [createVuetify()] },
    attachTo: document.body,
  })
}

function buttonByText(wrapper: ReturnType<typeof mountBar>, text: string) {
  return wrapper.findAll('button').find((button) => button.text().trim() === text)
}

describe('ApplicantStageBar', () => {
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
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('active applicant shows the stepper, Move to next, Hire and Reject', () => {
    seed()
    const wrapper = mountBar()
    const stages = wrapper.findAll('.applicant-stage-bar__stage')

    expect(stages.map((stage) => stage.text())).toEqual(['Applied', 'Screening', 'Offer'])
    expect(stages[1]?.attributes('aria-current')).toBe('step')
    expect(stages[0]?.attributes('aria-current')).toBeUndefined()
    expect(buttonByText(wrapper, 'Move to Offer')).toBeTruthy()
    expect(buttonByText(wrapper, 'Hire')).toBeTruthy()
    expect(buttonByText(wrapper, 'Reject')).toBeTruthy()
    expect(buttonByText(wrapper, 'Reopen')).toBeUndefined()
  })

  it('clicking a stage calls moveCandidate with that stage id', async () => {
    seed()
    const store = useApplicantsStore()
    const move = vi.spyOn(store, 'moveCandidate').mockResolvedValue()
    const wrapper = mountBar()

    await wrapper.findAll('.applicant-stage-bar__stage')[0]?.trigger('click')

    expect(move).toHaveBeenCalledWith('c1', 'applied')
  })

  it('last stage hides Move to', () => {
    seed({ stepId: 'offer' })
    const wrapper = mountBar()

    expect(wrapper.text()).not.toContain('Move to')
    expect(buttonByText(wrapper, 'Hire')).toBeTruthy()
  })

  it('hired applicant shows the outcome and Reopen, and no Hire/Reject/Move', async () => {
    seed({ status: 'hired' })
    const store = useApplicantsStore()
    const reopen = vi.spyOn(store, 'reopenCandidate').mockResolvedValue(true)
    const wrapper = mountBar()

    expect(wrapper.find('.applicant-stage-bar__outcome').text()).toBe('Hired')
    expect(buttonByText(wrapper, 'Hire')).toBeUndefined()
    expect(buttonByText(wrapper, 'Reject')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Move to')
    wrapper.findAll('.applicant-stage-bar__stage').forEach((stage) => {
      expect(stage.attributes('disabled')).toBeDefined()
    })

    await buttonByText(wrapper, 'Reopen')?.trigger('click')

    expect(reopen).toHaveBeenCalledWith('c1')
  })

  it('save indicator reads Saving..., Saved and "Couldn\'t save" for those statuses and Retry calls the retry handler', async () => {
    seed()
    const store = useApplicantsStore()
    let status: SaveStatus = 'saving'
    vi.spyOn(store, 'saveStatusFor').mockImplementation(() => status)
    const onRetry = vi.fn<() => void>()

    let wrapper = mountBar(onRetry)
    expect(wrapper.find('.applicant-save').text()).toContain('Saving...')
    wrapper.unmount()

    status = 'saved'
    wrapper = mountBar(onRetry)
    expect(wrapper.find('.applicant-save').text()).toContain('Saved')
    wrapper.unmount()

    status = 'failed'
    wrapper = mountBar(onRetry)
    expect(wrapper.find('.applicant-save').text()).toContain("Couldn't save")

    await buttonByText(wrapper, 'Retry')?.trigger('click')

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
