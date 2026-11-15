import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import AttentionList from '@/components/AttentionList.vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import RoleDeadlineTable from '@/components/RoleDeadlineTable.vue'
import type { AttentionItem } from '@/lib/overview'
import type { ApplicantEvent, Board, Candidate } from '@/types/pipeline'

const day = 24 * 60 * 60 * 1000

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'overview', component: { template: '<div />' } },
      { path: '/boards/:boardId', name: 'board', component: { template: '<div />' } },
    ],
  })
}

function mountWith(component: object, props: Record<string, unknown>) {
  return mount(component, {
    props,
    global: { plugins: [createVuetify(), router()] },
  })
}

function isoIn(days: number): string {
  const date = new Date(Date.now() + days * day)
  return date.toISOString().slice(0, 10)
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
    appliedAt: new Date().toISOString(),
    stepEnteredAt: new Date().toISOString(),
    education: [],
    experience: [],
  } satisfies Candidate
}

function board(overrides: Partial<Board> & { id: string; name: string }): Board {
  return {
    department: 'Engineering',
    openPositions: 2,
    deadline: isoIn(10),
    openedAt: new Date(Date.now() - 12 * day).toISOString(),
    steps: [
      { id: `${overrides.id}-s1`, name: 'Applied', position: 0 },
      { id: `${overrides.id}-s2`, name: 'Interview', position: 1 },
      { id: `${overrides.id}-s3`, name: 'Offer', position: 2 },
    ],
    candidates: [],
    ...overrides,
  }
}

describe('AttentionList', () => {
  const items: AttentionItem[] = [
    { kind: 'overdue', boardId: 'b1', title: 'Backend is 3 days past its deadline', detail: 'x' },
    { kind: 'final', boardId: 'b2', title: 'One applicant is at the final stage', detail: 'y' },
  ]

  it('renders each item with a link to its board', () => {
    const wrapper = mountWith(AttentionList, { items, total: 2 })
    const rows = wrapper.findAll('ul > li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Backend is 3 days past its deadline')
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0]!.attributes('href')).toBe('/boards/b1')
    expect(links[1]!.attributes('href')).toBe('/boards/b2')
    expect(links[0]!.text()).toContain('Open board')
    expect(wrapper.text()).not.toContain('Showing')
  })

  it('marks the overdue icon as danger and others not', () => {
    const wrapper = mountWith(AttentionList, { items, total: 2 })
    const tiles = wrapper.findAll('.ov-queue__icon')
    expect(tiles[0]!.classes()).toContain('ov-queue__icon--danger')
    expect(tiles[1]!.classes()).not.toContain('ov-queue__icon--danger')
  })

  it('shows how many are listed when truncated', () => {
    const wrapper = mountWith(AttentionList, { items, total: 9 })
    expect(wrapper.text()).toContain('Showing 2 of 9.')
  })

  it('shows the empty state', () => {
    const wrapper = mountWith(AttentionList, { items: [], total: 0 })
    expect(wrapper.text()).toContain('Nothing needs attention. Every role is within its deadline.')
    expect(wrapper.find('ul').exists()).toBe(false)
  })
})

describe('ActivityFeed', () => {
  const events: ApplicantEvent[] = [
    {
      id: 'e1',
      boardId: 'b1',
      applicantId: 'a1',
      actorName: 'Sam',
      action: 'hired',
      message: 'Sam hired Thandi Dube',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'e2',
      boardId: 'missing',
      applicantId: 'a2',
      actorName: 'Sam',
      action: 'moved',
      message: 'Sam moved Lerato to Interview',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ]
  const boards = [board({ id: 'b1', name: 'Backend Engineer' })]

  it('maps an event to its message, board name and relative time', () => {
    const wrapper = mountWith(ActivityFeed, { events, boards })
    const rows = wrapper.findAll('ul > li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Sam hired Thandi Dube')
    expect(rows[0]!.text()).toContain('Backend Engineer')
    expect(rows[0]!.text()).toContain('2 hours ago')
    expect(rows[0]!.find('.mdi-check-circle-outline').exists()).toBe(true)
  })

  it('omits the board name when the board is not found', () => {
    const wrapper = mountWith(ActivityFeed, { events, boards })
    const second = wrapper.findAll('ul > li')[1]!
    expect(second.text()).toContain('5 minutes ago')
    expect(second.text()).not.toContain('Backend Engineer')
  })

  it('shows the empty state', () => {
    const wrapper = mountWith(ActivityFeed, { events: [], boards })
    expect(wrapper.text()).toContain('No recent activity.')
    expect(wrapper.find('ul').exists()).toBe(false)
  })
})

describe('RoleDeadlineTable', () => {
  const late = board({
    id: 'late',
    name: 'Late role',
    deadline: isoIn(-4),
    openPositions: 2,
    candidates: [
      candidate('c1', 'late', 'late-s1', 'active'),
      candidate('c2', 'late', 'late-s2', 'active'),
      candidate('c3', 'late', 'late-s3', 'rejected'),
    ],
  })
  const soon = board({
    id: 'soon',
    name: 'Soon role',
    deadline: isoIn(5),
    openPositions: 3,
    candidates: [candidate('c4', 'soon', 'soon-s1', 'hired')],
  })
  const single = board({
    id: 'single',
    name: 'Single stage role',
    deadline: isoIn(20),
    openPositions: 1,
    steps: [{ id: 'only', name: 'Applied', position: 0 }],
    candidates: [candidate('c5', 'single', 'only', 'active')],
  })

  it('sorts rows by deadline', () => {
    const wrapper = mountWith(RoleDeadlineTable, {
      boards: [single, soon, late],
      selectedId: null,
    })
    const names = wrapper
      .findAll('.ov-roles__table > tbody > tr')
      .map((row) => row.find('a').text())
    expect(names).toEqual(['Late role', 'Soon role', 'Single stage role'])
  })

  it('links the role name to its board', () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [late], selectedId: null })
    expect(wrapper.find('.ov-roles__table > tbody a').attributes('href')).toBe('/boards/late')
  })

  it('shows positions text and progressbar values', () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [late, soon], selectedId: null })
    const rows = wrapper.findAll('.ov-roles__table > tbody > tr')
    expect(rows[0]!.text()).toContain('0 of 2')
    expect(rows[1]!.text()).toContain('1 of 3')
    const bar = rows[1]!.find('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('1')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('3')
    expect(bar.attributes('aria-label')).toBe('Positions filled for Soon role')
  })

  it('applies the danger class only to the past-deadline chip', () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [late, soon], selectedId: null })
    const chips = wrapper.findAll('.ov-roles__deadline')
    expect(chips[0]!.classes()).toContain('ov-roles__deadline--overdue')
    expect(chips[0]!.text()).toContain('4 days overdue')
    expect(chips[1]!.classes()).not.toContain('ov-roles__deadline--overdue')
  })

  it('counts active applicants and shows the stage line', () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [late], selectedId: null })
    expect(wrapper.find('td.ov-roles__num').text()).toBe('2')
    expect(wrapper.find('svg[aria-label="Applicants per stage for Late role"]').exists()).toBe(true)
  })

  it('renders a board with a single stage', () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [single], selectedId: null })
    expect(wrapper.text()).toContain('1 stage')
    expect(wrapper.text()).not.toContain('1 stages')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('emits select from the focus button and marks the selected row', async () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [late, soon], selectedId: 'soon' })
    const rows = wrapper.findAll('.ov-roles__table > tbody > tr')
    expect(rows[1]!.classes()).toContain('is-selected')
    expect(rows[0]!.classes()).not.toContain('is-selected')
    const button = rows[0]!.find('button.ov-roles__focus')
    expect(button.attributes('aria-label')).toBe('Focus Late role')
    expect(rows[1]!.find('button.ov-roles__focus').attributes('aria-pressed')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['late']])
  })

  it('shows the caption', () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [late], selectedId: null })
    expect(wrapper.text()).toContain(
      "Each line runs from the board's first stage to its last stage, so boards with different stages stay comparable. Hover for the stage names.",
    )
  })

  it('shows the empty message and no table', () => {
    const wrapper = mountWith(RoleDeadlineTable, { boards: [], selectedId: null })
    expect(wrapper.text()).toContain('No role boards in this department.')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})
