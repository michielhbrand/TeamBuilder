import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import QuarterChart from '@/components/QuarterChart.vue'
import HireTimeChart from '@/components/HireTimeChart.vue'
import PipelineLine from '@/components/PipelineLine.vue'
import StageBars from '@/components/StageBars.vue'
import FlowRows from '@/components/FlowRows.vue'
import ChartTooltip from '@/components/ChartTooltip.vue'
import { clampTooltipTop, provideChartTooltip } from '@/lib/chart-tooltip'
import {
  axisMaxDays,
  barPath,
  dayTickStep,
  niceTicks,
  rowLabelWidth,
  thinStep,
} from '@/lib/chart-scale'
import type { QuarterPoint, RoleFlow } from '@/lib/overview'
import type { HireRecord } from '@/types/history'

function points(count: number): QuarterPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `2026-Q${(index % 4) + 1}`,
    label: `Q${(index % 4) + 1} 26`,
    partial: index === count - 1,
    applicantsIn: 40 + index * 3,
    hired: 5 + index,
    rejected: 20 + index * 2,
  }))
}

function hires(count: number): HireRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    applicantId: `a${index}`,
    department: index % 2 === 0 ? 'Engineering' : 'Design',
    hiredOn: `2026-0${(index % 9) + 1}-10`,
    daysToHire: 18 + ((index * 13) % 70),
  }))
}

const departments = ['Engineering', 'Design']
const quarters = ['2026-Q1', '2026-Q2', '2026-Q3']
const views = ['strip', 'range', 'curve', 'trend'] as const

describe('chart scale helpers', () => {
  it('rowLabelWidth clamps between 88px and 38% of the chart width', () => {
    expect(rowLabelWidth(['Design'], 300)).toBe(88)
    expect(rowLabelWidth(['Engineering'], 300)).toBe(89)
    expect(rowLabelWidth(['Customer success and sales'], 300)).toBe(114)
    expect(rowLabelWidth(['Customer success and sales'], 1000)).toBe(194)
    expect(rowLabelWidth([], 1000)).toBe(88)
  })

  it('niceTicks keeps at most five gridlines and covers the max', () => {
    for (const max of [1, 3, 7, 12, 48, 130, 999]) {
      const { ticks, top } = niceTicks(max)
      expect(ticks.length).toBeLessThanOrEqual(5)
      expect(ticks[0]).toBe(0)
      expect(top).toBeGreaterThanOrEqual(max)
    }
    expect(niceTicks(0).ticks).toEqual([0, 1])
  })

  it('axisMaxDays rounds up to a multiple of 20 with a minimum of 40', () => {
    expect(axisMaxDays([10])).toBe(40)
    expect(axisMaxDays([41])).toBe(60)
    expect(axisMaxDays([100])).toBe(100)
    expect(axisMaxDays([101])).toBe(120)
    expect(axisMaxDays([])).toBe(40)
  })

  it('dayTickStep widens on narrow plots and thinStep skips labels', () => {
    expect(dayTickStep(6)).toBe(20)
    expect(dayTickStep(2)).toBe(40)
    expect(dayTickStep(1)).toBe(60)
    expect(thinStep(60, 46)).toBe(1)
    expect(thinStep(20, 46)).toBe(3)
  })
})

describe('barPath', () => {
  it('draws a flat rectangle without rounding', () => {
    expect(barPath(10, 20, 30, 40, false)).toBe('M10,20H40V60H10Z')
  })

  it('rounds only the top corners by 4px and clamps the radius to the height', () => {
    expect(barPath(10, 20, 30, 40, true)).toBe('M10,60V24Q10,20 14,20H36Q40,20 40,24V60Z')
    expect(barPath(10, 20, 30, 2, true)).toBe('M10,22V22Q10,20 12,20H38Q40,20 40,22V22Z')
  })
})

describe('chart tooltip position', () => {
  it('clampTooltipTop places the tooltip below the pointer and flips above near the bottom', () => {
    expect(clampTooltipTop(100, 800)).toBe(116)
    const flipped = clampTooltipTop(780, 800)
    expect(flipped).toBeLessThan(780)
    expect(flipped + 90).toBeLessThanOrEqual(800)
    expect(clampTooltipTop(5, 40)).toBeGreaterThanOrEqual(10)
  })
})

describe('QuarterChart', () => {
  it('draws one bar group per point and lists the numbers in an accessible table', () => {
    const wrapper = mount(QuarterChart, { props: { points: points(4), kind: 'decisions' } })

    expect(wrapper.findAll('.ov-qbar')).toHaveLength(4)
    const svg = wrapper.get('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('Hired and rejected per quarter, 4 quarters')
    const table = wrapper.get('table.sr-only')
    expect(table.find('caption').exists()).toBe(true)
    expect(table.findAll('tbody tr')).toHaveLength(4)
    expect(table.text()).toContain('Q1 26')
    expect(table.findAll('tbody tr')[0]?.text()).toContain('5')
    expect(table.findAll('tbody tr')[0]?.text()).toContain('20')
  })

  it('marks the partial quarter with an asterisk and keeps svg text at 12px', () => {
    const wrapper = mount(QuarterChart, { props: { points: points(3), kind: 'applicants' } })

    const labels = wrapper.findAll('svg text').map((node) => node.text())
    expect(labels).toContain('Q3 26*')
    expect(wrapper.get('svg').attributes('font-size')).toBe('12')
    expect(wrapper.get('svg').attributes('aria-label')).toBe(
      'Applicants in per quarter, 3 quarters',
    )
  })

  describe('bar geometry', () => {
    function bounds(wrapper: ReturnType<typeof mount>, selector: string) {
      const paths = wrapper.findAll(selector)
      expect(paths).toHaveLength(1)
      const d = paths[0]?.attributes('d') as string
      const rounded = d.match(/^M[\d.]+,([\d.]+)V[\d.]+Q[\d.]+,([\d.]+) /)
      if (rounded) {
        return { rounded: true, top: Number(rounded[2]), bottom: Number(rounded[1]) }
      }
      const flat = d.match(/^M[\d.]+,([\d.]+)H[\d.]+V([\d.]+)H/) as RegExpMatchArray
      return { rounded: false, top: Number(flat[1]), bottom: Number(flat[2]) }
    }

    const point = (hired: number, rejected: number): QuarterPoint => ({
      key: '2026-Q1',
      label: 'Q1 26',
      partial: false,
      applicantsIn: 0,
      hired,
      rejected,
    })
    const hiredPath = '.ov-qbar path.ov-fill-signal'
    const rejectedPath = '.ov-qbar path.ov-fill-line-input'

    it('stacks a flat hired bar below a rounded rejected bar with a 2px gap', () => {
      const wrapper = mount(QuarterChart, {
        props: { points: [point(10, 30)], kind: 'decisions' },
      })
      const hired = bounds(wrapper, hiredPath)
      const rejected = bounds(wrapper, rejectedPath)

      expect(hired.bottom).toBe(190)
      expect(hired.top).toBe(145)
      expect(hired.rounded).toBe(false)
      expect(rejected.rounded).toBe(true)
      expect(rejected.top).toBe(10)
      expect(hired.top - rejected.bottom).toBe(2)
    })

    it('rounds the lone segment and anchors it to the baseline when one side is zero', () => {
      const onlyRejected = mount(QuarterChart, {
        props: { points: [point(0, 20)], kind: 'decisions' },
      })
      expect(onlyRejected.find(hiredPath).exists()).toBe(false)
      expect(bounds(onlyRejected, rejectedPath)).toMatchObject({ rounded: true, bottom: 190 })

      const onlyHired = mount(QuarterChart, {
        props: { points: [point(20, 0)], kind: 'decisions' },
      })
      expect(onlyHired.find(rejectedPath).exists()).toBe(false)
      expect(bounds(onlyHired, hiredPath)).toMatchObject({ rounded: true, bottom: 190 })
    })

    it('keeps a tiny stacked segment at least 1px tall', () => {
      const wrapper = mount(QuarterChart, {
        props: { points: [point(100, 1)], kind: 'decisions' },
      })
      const rejected = bounds(wrapper, rejectedPath)
      const hired = bounds(wrapper, hiredPath)

      expect(rejected.bottom - rejected.top).toBe(1)
      expect(hired.top - rejected.bottom).toBe(2)
    })

    it('draws applicant bars rounded on the baseline', () => {
      const wrapper = mount(QuarterChart, {
        props: { points: [{ ...point(0, 0), applicantsIn: 12 }], kind: 'applicants' },
      })
      expect(bounds(wrapper, '.ov-qbar path.ov-fill-accent')).toMatchObject({
        rounded: true,
        bottom: 190,
      })
    })
  })

  it('never draws more than five gridlines', () => {
    const wrapper = mount(QuarterChart, { props: { points: points(9), kind: 'applicants' } })

    expect(wrapper.findAll('line.ov-grid').length).toBeLessThanOrEqual(5)
  })

  it('shows the empty message for no points or all zeros', () => {
    const none = mount(QuarterChart, { props: { points: [], kind: 'decisions' } })
    expect(none.get('.ov-empty').text()).toBe('No history recorded yet.')
    expect(none.find('svg').exists()).toBe(false)

    const zeros = mount(QuarterChart, {
      props: {
        points: points(2).map((point) => ({ ...point, hired: 0, rejected: 0, applicantsIn: 0 })),
        kind: 'decisions',
      },
    })
    expect(zeros.get('.ov-empty').text()).toBe('No history recorded yet.')
  })

  it('shows the tooltip with the hired share on hover', async () => {
    const Host = {
      setup() {
        provideChartTooltip()
        return () =>
          h('div', [h(QuarterChart, { points: points(2), kind: 'decisions' }), h(ChartTooltip)])
      },
    }
    vi.stubGlobal('innerWidth', 1000)
    const wrapper = mount(Host)

    wrapper
      .get('.ov-qbar')
      .element.dispatchEvent(
        new MouseEvent('pointerenter', { clientX: 200, clientY: 100, bubbles: true }),
      )
    await nextTick()
    const tip = wrapper.get('[role="tooltip"]')
    expect(tip.attributes('data-active')).toBe('true')
    expect(tip.text()).toContain('Q1 26')
    expect(tip.text()).toContain('5 hired · 20 rejected (20% hired)')

    wrapper.get('.ov-qbar').element.dispatchEvent(new MouseEvent('pointerleave'))
    await nextTick()
    expect(tip.attributes('data-active')).toBe('false')
    vi.unstubAllGlobals()
  })
})

describe('HireTimeChart', () => {
  for (const view of views) {
    it(`renders the ${view} view for 1, many and zero hires`, () => {
      const base = { departments, view, quarters }

      const one = mount(HireTimeChart, { props: { ...base, hires: hires(1) } })
      expect(one.get('svg').attributes('role')).toBe('img')
      expect(one.get('svg').attributes('aria-label')).toBeTruthy()
      expect(one.get('table.sr-only').find('caption').exists()).toBe(true)

      const many = mount(HireTimeChart, { props: { ...base, hires: hires(40) } })
      expect(many.find('svg').exists()).toBe(true)
      expect(many.find('.ov-empty').exists()).toBe(false)

      const none = mount(HireTimeChart, { props: { ...base, hires: [] } })
      expect(none.get('.ov-empty').text()).toBe('No hires in this range.')
      expect(none.find('svg').exists()).toBe(false)
    })
  }

  it('sizes the x axis in days from the largest value, in steps of 20', () => {
    const wrapper = mount(HireTimeChart, {
      props: {
        hires: [{ applicantId: 'a', department: 'Design', hiredOn: '2026-02-01', daysToHire: 95 }],
        departments: ['Design'],
        view: 'range',
        quarters,
      },
    })
    const labels = wrapper.findAll('svg text').map((node) => node.text())
    expect(labels).toContain('100 days')
    expect(labels).not.toContain('120 days')
    expect(labels).toContain('95 d')

    const small = mount(HireTimeChart, {
      props: {
        hires: [{ applicantId: 'a', department: 'Design', hiredOn: '2026-02-01', daysToHire: 10 }],
        departments: ['Design'],
        view: 'strip',
        quarters,
      },
    })
    expect(small.findAll('svg text').map((node) => node.text())).toContain('40 days')
  })

  describe('at a narrow width', () => {
    const width = vi.spyOn(Element.prototype, 'clientWidth', 'get')

    afterEach(() => {
      width.mockReset()
    })

    it('keeps the department label column at least 88px and untruncated for short names', async () => {
      width.mockReturnValue(300)
      const wrapper = mount(HireTimeChart, {
        props: {
          hires: [
            { applicantId: 'a', department: 'Engineering', hiredOn: '2026-02-01', daysToHire: 30 },
          ],
          departments: ['Engineering'],
          view: 'strip',
          quarters,
        },
      })

      await nextTick()
      const label = wrapper.findAll('svg text.ov-strong')[0]
      expect(label?.text()).toBe('Engineering')
      const leftEdge = Number(wrapper.get('svg line.ov-grid').attributes('x1'))
      expect(leftEdge).toBeGreaterThanOrEqual(88)
    })

    it('truncates only names longer than the label column', async () => {
      width.mockReturnValue(300)
      const wrapper = mount(HireTimeChart, {
        props: {
          hires: [
            {
              applicantId: 'a',
              department: 'Customer success and sales',
              hiredOn: '2026-02-01',
              daysToHire: 30,
            },
          ],
          departments: ['Customer success and sales'],
          view: 'range',
          quarters,
        },
      })

      await nextTick()
      const text = wrapper.findAll('svg text.ov-strong')[0]?.text() ?? ''
      expect(text.endsWith('…')).toBe(true)
      expect(text.length).toBeGreaterThanOrEqual(12)
    })

    it('moves the half label left of its marker when the nine-in-ten line would cross it', async () => {
      width.mockReturnValue(300)
      const wrapper = mount(HireTimeChart, {
        props: {
          hires: [60, 62, 64, 66, 68, 70, 72, 74, 76, 78].map((daysToHire, index) => ({
            applicantId: `a${index}`,
            department: 'Design',
            hiredOn: '2026-02-01',
            daysToHire,
          })),
          departments: ['Design'],
          view: 'curve',
          quarters,
        },
      })

      await nextTick()
      const labels = wrapper.findAll('svg text.ov-halo')
      expect(labels).toHaveLength(2)
      expect(labels[0]?.attributes('text-anchor')).toBe('end')
    })
  })

  it('draws curve value labels with a halo and keeps them above both marker lines', () => {
    const curve = mount(HireTimeChart, {
      props: { hires: hires(10), departments, view: 'curve', quarters },
    })
    const children = [...curve.get('svg').element.children]
    const lastLine = children.map((node) => node.tagName).lastIndexOf('g')
    const firstLabel = children.findIndex((node) => node.classList.contains('ov-halo'))
    expect(firstLabel).toBeGreaterThan(lastLine)
    expect(curve.findAll('svg text.ov-halo')).toHaveLength(2)
  })

  it('uses the singular day in curve labels', () => {
    const curve = mount(HireTimeChart, {
      props: {
        hires: [{ applicantId: 'a', department: 'Design', hiredOn: '2026-02-01', daysToHire: 1 }],
        departments,
        view: 'curve',
        quarters,
      },
    })
    expect(curve.findAll('svg text').map((node) => node.text())).toContain('half within 1 day')
  })

  it('labels the half and nine-in-ten markers on the curve and one dot per hire on the strip', () => {
    const curve = mount(HireTimeChart, {
      props: { hires: hires(10), departments, view: 'curve', quarters },
    })
    const text = curve.findAll('svg text').map((node) => node.text())
    expect(text.some((entry) => /^half within \d+ days$/.test(entry))).toBe(true)
    expect(text.some((entry) => /^9 in 10 within \d+ days$/.test(entry))).toBe(true)

    const strip = mount(HireTimeChart, {
      props: { hires: hires(7), departments, view: 'strip', quarters },
    })
    expect(strip.findAll('.ov-dot')).toHaveLength(7)
  })

  describe('trend view', () => {
    const record = (id: string, hiredOn: string, daysToHire: number): HireRecord => ({
      applicantId: id,
      department: 'Design',
      hiredOn,
      daysToHire,
    })
    const markers = (wrapper: ReturnType<typeof mount>) =>
      wrapper.findAll('svg circle.ov-fill-accent.ov-stroke-surface')

    it('labels each known median and skips quarters without hires', () => {
      const wrapper = mount(HireTimeChart, {
        props: {
          hires: [
            record('a', '2026-02-10', 30),
            record('b', '2026-03-01', 50),
            record('c', '2026-08-10', 61),
          ],
          departments: ['Design'],
          view: 'trend',
          quarters,
        },
      })

      const values = wrapper.findAll('svg text.ov-strong').map((node) => node.text())
      expect(values).toEqual(['40', '61'])
      expect(markers(wrapper)).toHaveLength(2)
      const rows = wrapper
        .findAll('table tbody tr')
        .map((row) => row.findAll('th, td').map((cell) => cell.text()))
      expect(rows).toEqual([
        ['Q1 26', '40'],
        ['Q2 26', '–'],
        ['Q3 26', '61'],
      ])
    })

    it('marks the partial quarter with an asterisk and "so far"', () => {
      const wrapper = mount(HireTimeChart, {
        props: {
          hires: [record('a', '2026-02-10', 30), record('c', '2026-08-10', 61)],
          departments: ['Design'],
          view: 'trend',
          quarters,
          partialKey: '2026-Q3',
        },
      })

      const labels = wrapper.findAll('svg text').map((node) => node.text())
      expect(labels).toContain('Q3 26*')
      expect(labels).toContain('Q1 26')
      expect(wrapper.findAll('table tbody th').map((cell) => cell.text())).toEqual([
        'Q1 26',
        'Q2 26',
        'Q3 26 (so far)',
      ])
    })

    it('draws a single known quarter as one point', () => {
      const wrapper = mount(HireTimeChart, {
        props: {
          hires: [record('a', '2026-02-10', 30)],
          departments: ['Design'],
          view: 'trend',
          quarters: ['2026-Q1'],
        },
      })

      expect(markers(wrapper)).toHaveLength(1)
      expect(wrapper.findAll('svg text.ov-strong').map((node) => node.text())).toEqual(['30'])
    })

    it('shows the empty message when no quarter has hires', () => {
      const wrapper = mount(HireTimeChart, {
        props: {
          hires: [record('a', '2025-02-10', 30)],
          departments: ['Design'],
          view: 'trend',
          quarters,
        },
      })

      expect(wrapper.get('.ov-empty').text()).toBe('No hires in this range.')
    })
  })

  it('draws every svg text node at 12px or larger', () => {
    for (const view of views) {
      const wrapper = mount(HireTimeChart, {
        props: { hires: hires(12), departments, view, quarters },
      })
      expect(wrapper.get('svg').attributes('font-size')).toBe('12')
    }
  })
})

describe('PipelineLine', () => {
  it('renders a flat baseline for all zeros and an empty baseline for no stages', () => {
    const zeros = mount(PipelineLine, {
      props: { counts: [0, 0, 0], names: ['Applied', 'Screen', 'Offer'], label: 'Designer' },
    })
    expect(zeros.findAll('circle')).toHaveLength(3)
    expect(zeros.get('svg').attributes('aria-label')).toBe('Applicants per stage for Designer')

    const empty = mount(PipelineLine, { props: { counts: [], names: [], label: 'Designer' } })
    expect(empty.find('svg').exists()).toBe(true)
    expect(empty.findAll('circle')).toHaveLength(0)
  })

  it('draws one dot for a single stage', () => {
    const wrapper = mount(PipelineLine, {
      props: { counts: [5], names: ['Applied'], label: 'Designer' },
    })
    expect(wrapper.findAll('circle')).toHaveLength(1)
    expect(wrapper.get('table.sr-only').text()).toContain('Applied')
  })
})

describe('StageBars', () => {
  it('renders an en dash for null and the value with its unit otherwise', () => {
    const wrapper = mount(StageBars, {
      props: {
        rows: [
          { name: 'Applied', value: 12, unit: 'days' },
          { name: 'Screen', value: null, unit: 'days' },
          { name: 'Offer', value: 3 },
        ],
      },
    })

    const values = wrapper.findAll('.ov-hbars__value').map((node) => node.text())
    expect(values).toEqual(['12 days', '–', '3'])
    const fills = wrapper.findAll('.ov-hbars__fill').map((node) => node.attributes('style'))
    expect(fills[0]).toContain('width: 100%')
    expect(fills[1]).toContain('width: 0%')
    expect(fills[2]).toContain('width: 25%')
  })

  it('uses the singular unit for a value of one', async () => {
    const Host = {
      setup() {
        provideChartTooltip()
        return () =>
          h('div', [
            h(StageBars, { rows: [{ name: 'Applied', value: 1, unit: 'days' }] }),
            h(ChartTooltip),
          ])
      },
    }
    vi.stubGlobal('innerWidth', 1000)
    const wrapper = mount(Host)

    expect(wrapper.get('.ov-hbars__value').text()).toBe('1 day')
    wrapper
      .get('.ov-hbars__row')
      .element.dispatchEvent(
        new MouseEvent('pointerenter', { clientX: 200, clientY: 100, bubbles: true }),
      )
    await nextTick()
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Appliedmedian 1 day')
    vi.unstubAllGlobals()
  })

  it('words the tooltip like the prototype and lets a row override it', async () => {
    const Host = {
      setup() {
        provideChartTooltip()
        return () =>
          h('div', [
            h(StageBars, {
              rows: [
                { name: 'Applied', value: 1 },
                { name: 'Screen', value: 5 },
                { name: 'Offer', value: 12, unit: 'days' },
                { name: 'Hired', value: null, unit: 'days' },
                { name: 'Custom', value: 2, tip: 'Custom wording' },
              ],
            }),
            h(ChartTooltip),
          ])
      },
    }
    vi.stubGlobal('innerWidth', 1000)
    const wrapper = mount(Host)
    const tip = wrapper.get('[role="tooltip"]')
    const rows = wrapper.findAll('.ov-hbars__row')
    const expected = [
      'Applied1 active applicant',
      'Screen5 active applicants',
      'Offermedian 12 days',
      'Hirednobody here',
      'CustomCustom wording',
    ]

    for (const [index, row] of rows.entries()) {
      row.element.dispatchEvent(
        new MouseEvent('pointerenter', { clientX: 200, clientY: 100, bubbles: true }),
      )
      await nextTick()
      expect(tip.text()).toBe(expected[index])
    }
    vi.unstubAllGlobals()
  })

  it('keeps zero-width bars when the max is 0', () => {
    const wrapper = mount(StageBars, { props: { rows: [{ name: 'Applied', value: 0 }] } })
    expect(wrapper.get('.ov-hbars__fill').attributes('style')).toContain('width: 0%')
  })
})

describe('FlowRows', () => {
  const rows: RoleFlow[] = [
    { boardId: 'b1', name: 'Designer', total: 20, hired: 2, rejected: 8, active: 10 },
    { boardId: 'b2', name: 'Engineer', total: 10, hired: 1, rejected: 3, active: 6 },
  ]

  it('emits select with the board id and marks the selected row', async () => {
    const wrapper = mount(FlowRows, { props: { rows, selectedId: 'b2' } })

    const buttons = wrapper.findAll('button[type="button"]')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.attributes('aria-pressed')).toBe('false')
    expect(buttons[1]?.attributes('aria-pressed')).toBe('true')
    expect(buttons[1]?.find('.ov-flow__dot').exists()).toBe(true)
    expect(buttons[0]?.text()).toContain('20 in / 10 decided')

    await buttons[0]?.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['b1']])
  })

  it('keeps the full label in a title attribute', () => {
    const wrapper = mount(FlowRows, { props: { rows, selectedId: null } })
    expect(wrapper.get('.ov-flow__label').attributes('title')).toBe('Designer')
  })
})
