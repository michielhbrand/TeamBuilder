import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import type { HireRecord, HiringMonth } from '@/types/history'
import type { ApplicantEvent, Board, Candidate } from '@/types/pipeline'

const mocks = vi.hoisted(() => ({
  fetchBoards: vi.fn<() => Promise<unknown>>(),
  fetchHiringMonthly: vi.fn<() => Promise<unknown>>(),
  fetchHireHistory: vi.fn<() => Promise<unknown>>(),
  fetchRecentEvents: vi.fn<(limit: number) => Promise<unknown>>(),
}))

vi.mock('@/lib/boards-api', () => ({ fetchBoards: mocks.fetchBoards }))
vi.mock('@/lib/history-api', () => ({
  fetchHiringMonthly: mocks.fetchHiringMonthly,
  fetchHireHistory: mocks.fetchHireHistory,
}))
vi.mock('@/lib/activity-api', () => ({ fetchRecentEvents: mocks.fetchRecentEvents }))
vi.mock('@/lib/applicants-api', () => ({}))
vi.mock('@/lib/storage-api', () => ({}))

import OverviewView from '@/views/OverviewView.vue'
import { useBoardsStore } from '@/stores/boards'
import { useHistoryStore } from '@/stores/history'
import { useApplicantActivityStore } from '@/stores/applicant-activity'

const day = 24 * 60 * 60 * 1000

function isoIn(days: number): string {
  return new Date(Date.now() + days * day).toISOString().slice(0, 10)
}

function candidate(id: string, boardId: string, stepId: string, status: Candidate['status']) {
  return {
    id,
    boardId,
    name: id,
    email: '',
    phone: '',
    currentRole: '',
    noticePeriodMonths: 0,
    salaryExpectationCents: 0,
    favorite: false,
    stepId,
    status,
    appliedAt: new Date(Date.now() - 5 * day).toISOString(),
    stepEnteredAt: new Date(Date.now() - 3 * day).toISOString(),
    education: [],
    experience: [],
  } satisfies Candidate
}

function board(id: string, name: string, department: string, candidates: Candidate[]): Board {
  return {
    id,
    name,
    department,
    openPositions: 2,
    deadline: isoIn(20),
    openedAt: new Date(Date.now() - 30 * day).toISOString(),
    steps: [
      { id: `${id}-s1`, name: 'Applied', position: 0 },
      { id: `${id}-s2`, name: 'Interview', position: 1 },
      { id: `${id}-s3`, name: 'Offer', position: 2 },
    ],
    candidates,
  }
}

function sampleBoards(): Board[] {
  return [
    board('b1', 'Backend Engineer', 'Engineering', [
      candidate('c1', 'b1', 'b1-s1', 'active'),
      candidate('c2', 'b1', 'b1-s3', 'active'),
    ]),
    board('b2', 'Product Designer', 'Design', [candidate('c3', 'b2', 'b2-s2', 'active')]),
    board('b3', 'Platform Engineer', 'Engineering', []),
  ]
}

const month = (department: string, hired: number, rejected: number): HiringMonth => ({
  month: new Date().toISOString().slice(0, 7) + '-01',
  department,
  applicantsIn: hired + rejected + 2,
  hired,
  rejected,
})

const hire = (id: string, department: string, daysToHire: number): HireRecord => ({
  applicantId: id,
  department,
  hiredOn: isoIn(-3),
  daysToHire,
})

const events: ApplicantEvent[] = [
  {
    id: 'e1',
    boardId: 'b1',
    applicantId: 'c1',
    actorName: 'Sam',
    action: 'moved',
    message: 'Sam moved c1 to Interview',
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: 'e2',
    boardId: 'b2',
    applicantId: 'c3',
    actorName: 'Sam',
    action: 'hired',
    message: 'Sam hired c3',
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
]

function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'overview', component: { template: '<div />' } },
      { path: '/boards', name: 'boards', component: { template: '<div />' } },
      { path: '/boards/:boardId', name: 'board', component: { template: '<div />' } },
    ],
  })

  return mount(OverviewView, {
    global: {
      plugins: [createVuetify(), router],
      stubs: { AppShell: { template: '<div><slot /></div>' } },
    },
  })
}

function kpi(wrapper: ReturnType<typeof mountView>, label: string) {
  const match = wrapper.findAll('.ov-kpi').find((node) => node.text().includes(label))
  expect(match).toBeTruthy()
  return match!
}

function chip(wrapper: ReturnType<typeof mountView>, label: string) {
  const match = wrapper.findAll('button').find((node) => node.text() === label)
  expect(match).toBeTruthy()
  return match!
}

function picker(wrapper: ReturnType<typeof mountView>) {
  return wrapper.get('select')
}

describe('OverviewView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.fetchHiringMonthly.mockResolvedValue([])
    mocks.fetchHireHistory.mockResolvedValue([])
    mocks.fetchRecentEvents.mockResolvedValue([])
  })

  async function seed(boards: Board[]) {
    useBoardsStore().boards = boards
    const wrapper = mountView()
    await flushPromises()
    return wrapper
  }

  it('shows the empty state when there are no boards', async () => {
    const wrapper = await seed([])

    expect(wrapper.text()).toContain('No role boards yet.')
    expect(wrapper.find('.ov-kpis').exists()).toBe(false)
  })

  it('renders the six KPI labels', async () => {
    const wrapper = await seed(sampleBoards())
    const labels = wrapper.findAll('.ov-kpi__label').map((node) => node.text())

    for (const label of [
      'Open positions',
      'Active applicants',
      'At final stage',
      'Hired last 4 quarters',
      'Time to a hire',
      'Hire rate',
    ]) {
      expect(labels.some((text) => text.includes(label))).toBe(true)
    }
    expect(kpi(wrapper, 'Open positions').get('.ov-kpi__value').text()).toBe('6')
    expect(kpi(wrapper, 'Active applicants').get('.ov-kpi__value').text()).toBe('3')
    expect(kpi(wrapper, 'At final stage').get('.ov-kpi__value').text()).toBe('1')
  })

  it('shows a dash for the hire rate and time to a hire when nobody is decided', async () => {
    const wrapper = await seed(sampleBoards())

    expect(kpi(wrapper, 'Hire rate').get('.ov-kpi__value').text()).toBe('–')
    expect(kpi(wrapper, 'Time to a hire').get('.ov-kpi__value').text()).toBe('–')
  })

  it('uses the department filter for the history KPIs', async () => {
    mocks.fetchHiringMonthly.mockResolvedValue([
      month('Engineering', 3, 1),
      month('Design', 1, 3),
      { ...month('Engineering', 5, 0), month: '2023-01-01' },
    ])
    mocks.fetchHireHistory.mockResolvedValue([
      hire('h1', 'Engineering', 20),
      hire('h2', 'Engineering', 40),
      hire('h3', 'Design', 90),
    ])
    const wrapper = await seed(sampleBoards())

    expect(kpi(wrapper, 'Hire rate').get('.ov-kpi__value').text()).toContain('69%')
    expect(kpi(wrapper, 'Hired last 4 quarters').get('.ov-kpi__value').text()).toBe('4')
    expect(kpi(wrapper, 'Hired last 4 quarters').text()).toContain('9 since records began')
    expect(kpi(wrapper, 'Time to a hire').get('.ov-kpi__value').text()).toContain('40')

    await chip(wrapper, 'Design').trigger('click')

    expect(kpi(wrapper, 'Hire rate').get('.ov-kpi__value').text()).toContain('25%')
    expect(kpi(wrapper, 'Hire rate').text()).toContain('1 hired · 3 rejected')
    expect(kpi(wrapper, 'Hired last 4 quarters').text()).toContain('1 since records began')
    expect(kpi(wrapper, 'Hired last 4 quarters').get('.ov-kpi__value').text()).toBe('1')
    expect(kpi(wrapper, 'Time to a hire').get('.ov-kpi__value').text()).toContain('90')
  })

  it('filters the role table and the board picker by department', async () => {
    const wrapper = await seed(sampleBoards())

    expect(wrapper.findAll('.ov-roles__table > tbody > tr')).toHaveLength(3)
    expect(picker(wrapper).findAll('option')).toHaveLength(3)

    await chip(wrapper, 'Design').trigger('click')

    expect(chip(wrapper, 'Design').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.ov-roles__table > tbody > tr')).toHaveLength(1)
    expect(wrapper.get('.ov-roles__table tbody').text()).toContain('Product Designer')
    expect(picker(wrapper).findAll('option')).toHaveLength(1)
    expect(wrapper.text()).toContain('Design · 1 live role')
  })

  it('resets to all departments when the selected department disappears', async () => {
    const boards = useBoardsStore()
    const wrapper = await seed(sampleBoards())

    await chip(wrapper, 'Design').trigger('click')
    boards.boards = boards.boards.filter((entry) => entry.department !== 'Design')
    await flushPromises()

    expect(chip(wrapper, 'All departments').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.ov-roles__table > tbody > tr')).toHaveLength(2)
  })

  it('falls back to the first filtered board in the picker', async () => {
    const wrapper = await seed(sampleBoards())
    const first = useBoardsStore().orderedBoards[0]!.id

    expect((picker(wrapper).element as HTMLSelectElement).value).toBe(first)

    await picker(wrapper).setValue('b2')
    expect((picker(wrapper).element as HTMLSelectElement).value).toBe('b2')

    await chip(wrapper, 'Engineering').trigger('click')
    const firstEngineering = useBoardsStore().orderedBoards.find(
      (entry) => entry.department === 'Engineering',
    )!.id
    expect((picker(wrapper).element as HTMLSelectElement).value).toBe(firstEngineering)
  })

  it('focuses a board from the role table and from the flow rows', async () => {
    const wrapper = await seed(sampleBoards())

    await wrapper.get('button[aria-label="Focus Product Designer"]').trigger('click')
    expect((picker(wrapper).element as HTMLSelectElement).value).toBe('b2')

    const flowRow = wrapper
      .findAll('.ov-flow__row')
      .find((node) => node.text().includes('Backend Engineer'))!
    await flowRow.trigger('click')
    expect((picker(wrapper).element as HTMLSelectElement).value).toBe('b1')
    expect(flowRow.attributes('aria-pressed')).toBe('true')
  })

  it('shows the focused board stage data and the slowest stage', async () => {
    const wrapper = await seed(sampleBoards())

    await picker(wrapper).setValue('b1')

    expect(wrapper.text()).toContain('Where active applicants are')
    expect(wrapper.text()).toContain('Time in the current stage')
    expect(wrapper.text()).toMatch(/Slowest stage on this board: \w+, median \d+ days\./)
  })

  it('explains that history is still empty', async () => {
    const wrapper = await seed(sampleBoards())

    expect(wrapper.text()).toContain('History fills in as applicants are hired and rejected.')
  })

  it('drops the empty-history note once history exists', async () => {
    mocks.fetchHiringMonthly.mockResolvedValue([month('Engineering', 2, 1)])
    mocks.fetchHireHistory.mockResolvedValue([hire('h1', 'Engineering', 25)])
    const wrapper = await seed(sampleBoards())

    expect(wrapper.text()).not.toContain('History fills in as applicants are hired and rejected.')
    expect(wrapper.text()).toContain('Hired and rejected, per quarter')
  })

  it('switches the range and hire-time view chips', async () => {
    mocks.fetchHiringMonthly.mockResolvedValue([month('Engineering', 2, 1)])
    mocks.fetchHireHistory.mockResolvedValue([hire('h1', 'Engineering', 25)])
    const wrapper = await seed(sampleBoards())

    expect(chip(wrapper, 'Last 4 quarters').attributes('aria-pressed')).toBe('true')
    await chip(wrapper, 'All on record').trigger('click')
    expect(chip(wrapper, 'All on record').attributes('aria-pressed')).toBe('true')

    expect(chip(wrapper, 'Every hire').attributes('aria-pressed')).toBe('true')
    await chip(wrapper, 'Trend').trigger('click')
    expect(chip(wrapper, 'Trend').attributes('aria-pressed')).toBe('true')
    expect(chip(wrapper, 'Every hire').attributes('aria-pressed')).toBe('false')
  })

  it('lists only the activity of filtered boards', async () => {
    mocks.fetchRecentEvents.mockResolvedValue(events)
    const wrapper = await seed(sampleBoards())

    expect(wrapper.get('.ov-feed').text()).toContain('Sam moved c1 to Interview')
    expect(wrapper.get('.ov-feed').text()).toContain('Sam hired c3')

    await chip(wrapper, 'Design').trigger('click')

    expect(wrapper.get('.ov-feed').text()).not.toContain('Sam moved c1 to Interview')
    expect(wrapper.get('.ov-feed').text()).toContain('Sam hired c3')
  })

  it('initializes the history store and loads recent activity on mount', async () => {
    await seed(sampleBoards())

    expect(mocks.fetchHiringMonthly).toHaveBeenCalledOnce()
    expect(mocks.fetchHireHistory).toHaveBeenCalledOnce()
    expect(mocks.fetchRecentEvents).toHaveBeenCalledWith(30)
    expect(useHistoryStore().initialized).toBe(true)
    expect(useApplicantActivityStore().recentLoaded).toBe(true)
  })

  it('mounts a single chart tooltip', async () => {
    const wrapper = await seed(sampleBoards())

    expect(wrapper.findAll('.ov-tooltip')).toHaveLength(1)
  })

  it('shows store errors as alerts', async () => {
    mocks.fetchHiringMonthly.mockRejectedValue(new Error('history unavailable'))
    const wrapper = await seed(sampleBoards())

    expect(wrapper.text()).toContain('history unavailable')
    expect(wrapper.find('.v-alert').exists()).toBe(true)
  })
})
