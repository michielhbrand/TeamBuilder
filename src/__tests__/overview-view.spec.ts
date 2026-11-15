import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import type { SheetModel } from '@/lib/export-sheets'
import type { HireRecord, HiringMonth } from '@/types/history'
import type { ApplicantEvent, Board, Candidate } from '@/types/pipeline'

const mocks = vi.hoisted(() => ({
  fetchBoards: vi.fn<() => Promise<unknown>>(),
  fetchHiringMonthly: vi.fn<() => Promise<unknown>>(),
  fetchHireHistory: vi.fn<() => Promise<unknown>>(),
  fetchRecentEvents: vi.fn<(limit: number) => Promise<unknown>>(),
  exportWorkbook: vi.fn<(sheets: SheetModel[], fileName: string) => Promise<void>>(),
}))

vi.mock('@/lib/boards-api', () => ({ fetchBoards: mocks.fetchBoards }))
vi.mock('@/lib/history-api', () => ({
  fetchHiringMonthly: mocks.fetchHiringMonthly,
  fetchHireHistory: mocks.fetchHireHistory,
}))
vi.mock('@/lib/activity-api', () => ({ fetchRecentEvents: mocks.fetchRecentEvents }))
vi.mock('@/lib/applicants-api', () => ({}))
vi.mock('@/lib/storage-api', () => ({}))
vi.mock('@/lib/export-xlsx', () => ({ exportWorkbook: mocks.exportWorkbook }))

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
    remChannel: '',
    salaryBand: '',
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
    mocks.exportWorkbook.mockReset()
    mocks.exportWorkbook.mockResolvedValue(undefined)
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

  it('focuses a board from the flow rows', async () => {
    const wrapper = await seed(sampleBoards())

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

    await chip(wrapper, 'Speed curve').trigger('click')
    expect(wrapper.text()).toContain(
      'The share of hires made within a number of days. Steeper and further left is faster.',
    )
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
    expect(wrapper.text()).not.toContain('History fills in as applicants are hired and rejected.')
  })

  it('keeps the picker, table and fallback in name order for all and for one department', async () => {
    const wrapper = await seed([
      board('z', 'Zeta role', 'Engineering', []),
      board('d', 'Design role', 'Design', []),
      board('a', 'Alpha role', 'Engineering', []),
    ])
    const options = () =>
      picker(wrapper)
        .findAll('option')
        .map((node) => node.text())

    expect(options()).toEqual(['Alpha role', 'Zeta role', 'Design role'])
    expect((picker(wrapper).element as HTMLSelectElement).value).toBe('a')

    await picker(wrapper).setValue('d')
    await chip(wrapper, 'Engineering').trigger('click')

    expect(options()).toEqual(['Alpha role', 'Zeta role'])
    expect((picker(wrapper).element as HTMLSelectElement).value).toBe('a')
    const rows = wrapper.findAll('.ov-roles__table > tbody > tr').map((node) => node.text())
    expect(rows).toHaveLength(2)
  })

  it('refreshes history when the view is mounted again after history was loaded', async () => {
    mocks.fetchHiringMonthly.mockResolvedValue([month('Engineering', 2, 1)])
    mocks.fetchHireHistory.mockResolvedValue([hire('h1', 'Engineering', 25)])
    await seed(sampleBoards())
    expect(mocks.fetchHiringMonthly).toHaveBeenCalledTimes(1)

    mountView()
    await flushPromises()

    expect(mocks.fetchHiringMonthly).toHaveBeenCalledTimes(2)
    expect(mocks.fetchHireHistory).toHaveBeenCalledTimes(2)
    expect(mocks.fetchRecentEvents).toHaveBeenCalledTimes(2)
  })

  it('shows live KPI values for the selected department only', async () => {
    const wrapper = await seed(sampleBoards())
    const values = () =>
      ['Open positions', 'Active applicants', 'At final stage'].map((label) =>
        kpi(wrapper, label).get('.ov-kpi__value').text(),
      )

    expect(values()).toEqual(['6', '3', '1'])

    await chip(wrapper, 'Design').trigger('click')
    expect(values()).toEqual(['2', '1', '0'])
    expect(kpi(wrapper, 'Open positions').text()).toContain('across 1 role')

    await chip(wrapper, 'Engineering').trigger('click')
    expect(values()).toEqual(['4', '2', '1'])
  })

  it('lists attention items for the selected department only', async () => {
    const late = board('late', 'Late designer', 'Design', [
      candidate('x1', 'late', 'late-s2', 'active'),
    ])
    late.deadline = isoIn(-3)
    const boards = [
      board('b1', 'Backend Engineer', 'Engineering', [
        candidate('c2', 'b1', 'b1-s3', 'active'),
        candidate('c1', 'b1', 'b1-s2', 'active'),
      ]),
      late,
    ]
    const wrapper = await seed(boards)
    const queue = () => wrapper.get('.ov-queue').text()

    expect(queue()).toContain('Late designer is 3 days past its deadline')
    expect(queue()).toContain('Backend Engineer')

    await chip(wrapper, 'Design').trigger('click')
    expect(queue()).toContain('Late designer is 3 days past its deadline')
    expect(queue()).not.toContain('Backend Engineer')

    await chip(wrapper, 'Engineering').trigger('click')
    expect(queue()).toContain('Backend Engineer')
    expect(queue()).not.toContain('Late designer')
  })

  describe('range and last-four-quarter rules', () => {
    const old = new Date()
    old.setUTCMonth(old.getUTCMonth() - 18, 1)
    const oldMonth = old.toISOString().slice(0, 10)
    const oldHire = {
      applicantId: 'old',
      department: 'Engineering',
      hiredOn: oldMonth,
      daysToHire: 200,
    }

    beforeEach(() => {
      mocks.fetchHiringMonthly.mockResolvedValue([
        month('Engineering', 2, 1),
        { ...month('Engineering', 4, 0), month: oldMonth },
      ])
      mocks.fetchHireHistory.mockResolvedValue([
        hire('h1', 'Engineering', 20),
        hire('h2', 'Engineering', 40),
        oldHire,
      ])
    })

    const quarterRows = (wrapper: ReturnType<typeof mountView>) =>
      wrapper
        .findAll('.ov-panel')
        .find((node) => node.text().includes('Hired and rejected, per quarter'))!
        .findAll('table.sr-only tbody tr')
    const hireCount = (wrapper: ReturnType<typeof mountView>) =>
      wrapper
        .findAll('.ov-panel')
        .find((node) => node.text().includes('How long hires take'))!
        .findAll('table.sr-only tbody tr')[0]!
        .findAll('td')[0]!
        .text()

    it('excludes data older than four quarters until "All on record" is chosen', async () => {
      const wrapper = await seed(sampleBoards())

      expect(quarterRows(wrapper)).toHaveLength(4)
      expect(hireCount(wrapper)).toBe('2')

      await chip(wrapper, 'All on record').trigger('click')

      expect(quarterRows(wrapper)).toHaveLength(7)
      expect(quarterRows(wrapper)[0]!.text()).toContain('4')
      expect(hireCount(wrapper)).toBe('3')

      await chip(wrapper, 'Last 4 quarters').trigger('click')
      expect(quarterRows(wrapper)).toHaveLength(4)
      expect(hireCount(wrapper)).toBe('2')
    })

    it('ignores older hires in the time-to-a-hire and last-four-quarter KPIs', async () => {
      const wrapper = await seed(sampleBoards())

      expect(kpi(wrapper, 'Time to a hire').get('.ov-kpi__value').text()).toContain('30')
      expect(kpi(wrapper, 'Hired last 4 quarters').get('.ov-kpi__value').text()).toBe('2')
      expect(kpi(wrapper, 'Hired last 4 quarters').text()).toContain('6 since records began')
    })
  })

  describe('without live boards', () => {
    it('keeps the history sections and KPIs and shows the empty state in place of live ones', async () => {
      mocks.fetchHiringMonthly.mockResolvedValue([month('Engineering', 3, 1)])
      mocks.fetchHireHistory.mockResolvedValue([hire('h1', 'Engineering', 25)])
      const wrapper = await seed([])
      const text = wrapper.text()

      expect(text).toContain('No role boards yet.')
      for (const label of ['Hired last 4 quarters', 'Time to a hire', 'Hire rate']) {
        expect(wrapper.findAll('.ov-kpi__label').some((node) => node.text().includes(label))).toBe(
          true,
        )
      }
      expect(kpi(wrapper, 'Hired last 4 quarters').get('.ov-kpi__value').text()).toBe('3')
      expect(wrapper.findAll('.ov-kpi')).toHaveLength(3)
      expect(text).toContain('Hiring over time')
      expect(text).toContain('Hired and rejected, per quarter')
      expect(text).toContain('How long hires take')
      for (const hidden of [
        'Open positions',
        'Needs your attention',
        'Latest activity',
        'Roles by deadline',
        'One board in focus',
      ]) {
        expect(text).not.toContain(hidden)
      }
      expect(wrapper.find('select').exists()).toBe(false)
    })

    it('shows only the empty state when there is no history either', async () => {
      const wrapper = await seed([])

      expect(wrapper.text()).toContain('No role boards yet.')
      expect(wrapper.find('.ov-kpis').exists()).toBe(false)
      expect(wrapper.find('.ov-chip').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Hiring over time')
    })
  })

  describe('departments known only from history', () => {
    beforeEach(() => {
      mocks.fetchHiringMonthly.mockResolvedValue([
        month('Sales', 2, 2),
        month('Engineering', 1, 0),
        month('Aviation', 1, 1),
      ])
      mocks.fetchHireHistory.mockResolvedValue([hire('h1', 'Sales', 25)])
    })

    it('offers a chip per department in the known order, then alphabetical', async () => {
      const wrapper = await seed(sampleBoards())
      const labels = wrapper
        .findAll('[aria-label="Department"] .ov-chip')
        .map((node) => node.text())

      expect(labels).toEqual(['All departments', 'Engineering', 'Design', 'Sales', 'Aviation'])
    })

    it('zeroes the live widgets for a department without boards but keeps its history', async () => {
      const wrapper = await seed(sampleBoards())

      await chip(wrapper, 'Sales').trigger('click')

      expect(kpi(wrapper, 'Open positions').get('.ov-kpi__value').text()).toBe('0')
      expect(kpi(wrapper, 'Active applicants').get('.ov-kpi__value').text()).toBe('0')
      expect(kpi(wrapper, 'Hire rate').get('.ov-kpi__value').text()).toContain('50%')
      expect(wrapper.text()).toContain('No role boards in this department.')
      expect(wrapper.find('select').exists()).toBe(false)
    })

    it('says so when a department has boards but no history', async () => {
      const wrapper = await seed(sampleBoards())

      await chip(wrapper, 'Design').trigger('click')

      expect(wrapper.text()).toContain('No history for this department yet.')
      await chip(wrapper, 'All departments').trigger('click')
      expect(wrapper.text()).not.toContain('No history for this department yet.')
    })

    it('resets to all when a history-only department disappears', async () => {
      const wrapper = await seed(sampleBoards())
      await chip(wrapper, 'Sales').trigger('click')

      useHistoryStore().months = []
      await flushPromises()

      expect(chip(wrapper, 'All departments').attributes('aria-pressed')).toBe('true')
    })
  })

  describe('Excel export', () => {
    const EXPORT_ERROR = 'The export could not be created. Try again.'
    const exportButton = (wrapper: ReturnType<typeof mountView>) =>
      wrapper.findAll('button').find((node) => node.text() === 'Export to Excel')

    const activeRoleNames = (sheets: SheetModel[]) => {
      const sheet = sheets.find((entry) => entry.name === 'Active roles')!
      const index = sheet.columns.findIndex((entry) => entry.header === 'Role')
      return sheet.rows.map((row) => row[index])
    }

    it('exports a workbook for all departments with a dated file name', async () => {
      const wrapper = await seed(sampleBoards())

      await exportButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(mocks.exportWorkbook).toHaveBeenCalledOnce()
      const [sheets, fileName] = mocks.exportWorkbook.mock.calls[0]!
      expect(sheets[0]!.name).toBe('Summary')
      expect(fileName).toMatch(/^TeamBuilder-overview-all-departments-\d{4}-\d{2}-\d{2}\.xlsx$/)
      expect(activeRoleNames(sheets)).toHaveLength(3)
      expect(wrapper.text()).not.toContain('The export could not be created.')
    })

    it('exports only the selected department', async () => {
      const wrapper = await seed(sampleBoards())

      await chip(wrapper, 'Design').trigger('click')
      await exportButton(wrapper)!.trigger('click')
      await flushPromises()

      const [sheets, fileName] = mocks.exportWorkbook.mock.calls[0]!
      expect(activeRoleNames(sheets)).toEqual(['Product Designer'])
      expect(fileName).toContain('design')
    })

    it('ignores a second click while the export is pending', async () => {
      let resolve!: () => void
      mocks.exportWorkbook.mockReturnValue(new Promise<void>((done) => (resolve = done)))
      const wrapper = await seed(sampleBoards())

      await exportButton(wrapper)!.trigger('click')
      await exportButton(wrapper)!.trigger('click')

      expect(mocks.exportWorkbook).toHaveBeenCalledOnce()
      expect(exportButton(wrapper)!.attributes('disabled')).toBeDefined()
      expect(wrapper.find('.v-btn--loading').exists()).toBe(true)

      resolve()
      await flushPromises()

      expect(exportButton(wrapper)!.attributes('disabled')).toBeUndefined()
      expect(wrapper.find('.v-btn--loading').exists()).toBe(false)
    })

    it('guards against re-entry even when the click bypasses the disabled button', async () => {
      let resolve!: () => void
      mocks.exportWorkbook.mockReturnValue(new Promise<void>((done) => (resolve = done)))
      const wrapper = await seed(sampleBoards())
      const button = wrapper.findAllComponents({ name: 'VBtn' }).find((node) => {
        return node.text() === 'Export to Excel'
      })!

      button.vm.$emit('click', new MouseEvent('click'))
      button.vm.$emit('click', new MouseEvent('click'))
      await flushPromises()

      expect(mocks.exportWorkbook).toHaveBeenCalledOnce()

      resolve()
      await flushPromises()
    })

    it('is disabled while history is loading and enabled once it has loaded', async () => {
      let resolve!: (value: unknown[]) => void
      mocks.fetchHiringMonthly.mockReturnValue(new Promise((done) => (resolve = done)))
      const wrapper = await seed(sampleBoards())

      expect(exportButton(wrapper)!.attributes('disabled')).toBeDefined()
      expect(wrapper.find('.v-btn--loading').exists()).toBe(false)
      await exportButton(wrapper)!.trigger('click')
      expect(mocks.exportWorkbook).not.toHaveBeenCalled()

      resolve([])
      await flushPromises()

      expect(exportButton(wrapper)!.attributes('disabled')).toBeUndefined()
    })

    it('is disabled when history failed to load', async () => {
      mocks.fetchHiringMonthly.mockRejectedValue(new Error('history unavailable'))
      const wrapper = await seed(sampleBoards())

      expect(exportButton(wrapper)).toBeTruthy()
      expect(exportButton(wrapper)!.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('history unavailable')
    })

    it('clears a stale export error when the department changes', async () => {
      mocks.exportWorkbook.mockRejectedValueOnce(new Error('boom'))
      const wrapper = await seed(sampleBoards())

      await exportButton(wrapper)!.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(EXPORT_ERROR)

      await chip(wrapper, 'Design').trigger('click')

      expect(wrapper.text()).not.toContain(EXPORT_ERROR)
    })

    it('shows an alert when the export fails and clears it on the next attempt', async () => {
      mocks.exportWorkbook.mockRejectedValueOnce(new Error('boom'))
      const wrapper = await seed(sampleBoards())

      await exportButton(wrapper)!.trigger('click')
      await flushPromises()

      const alert = wrapper.findAll('.v-alert').find((node) => node.text() === EXPORT_ERROR)
      expect(alert).toBeTruthy()
      expect(exportButton(wrapper)!.attributes('disabled')).toBeUndefined()

      await exportButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(mocks.exportWorkbook).toHaveBeenCalledTimes(2)
      expect(wrapper.text()).not.toContain(EXPORT_ERROR)
    })

    it('is hidden when there are neither boards nor history', async () => {
      const wrapper = await seed([])

      expect(exportButton(wrapper)).toBeUndefined()
    })

    it('is available when only history exists', async () => {
      mocks.fetchHiringMonthly.mockResolvedValue([month('Engineering', 3, 1)])
      mocks.fetchHireHistory.mockResolvedValue([hire('h1', 'Engineering', 25)])
      const wrapper = await seed([])

      expect(exportButton(wrapper)).toBeTruthy()

      await exportButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(mocks.exportWorkbook).toHaveBeenCalledOnce()
    })
  })

  it('groups thousands in KPI numbers', async () => {
    mocks.fetchHiringMonthly.mockResolvedValue([month('Engineering', 1500, 500)])
    const wrapper = await seed(sampleBoards())

    expect(kpi(wrapper, 'Hired last 4 quarters').get('.ov-kpi__value').text()).toBe('1,500')
    expect(kpi(wrapper, 'Hired last 4 quarters').text()).toContain('1,500 since records began')
  })
})
