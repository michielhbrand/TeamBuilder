import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import OverviewKpi from '@/components/OverviewKpi.vue'
import OverviewPanel from '@/components/OverviewPanel.vue'
import ChartTooltip from '@/components/ChartTooltip.vue'
import { provideChartTooltip, useChartTooltip } from '@/lib/chart-tooltip'
import { useElementWidth } from '@/lib/use-element-width'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OverviewPanel', () => {
  it('renders the title, subtitle and live source tag', () => {
    const wrapper = mount(OverviewPanel, {
      props: { title: 'Department workload', subtitle: 'Active applicants', source: 'live' },
      slots: { default: '<p>Body</p>', actions: '<button>Action</button>' },
    })

    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.get('h2').text()).toBe('Department workload')
    expect(wrapper.text()).toContain('Active applicants')
    expect(wrapper.text()).toContain('Live boards')
    expect(wrapper.text()).toContain('Body')
    expect(wrapper.text()).toContain('Action')
  })

  it('renders the history source tag and labels the section by its heading', () => {
    const wrapper = mount(OverviewPanel, {
      props: { title: 'Hiring over time', source: 'history' },
    })

    expect(wrapper.text()).toContain('History table')
    const id = wrapper.get('h2').attributes('id')
    expect(id).toBeTruthy()
    expect(wrapper.attributes('aria-labelledby')).toBe(id)
  })

  it('omits the source tag when no source is given', () => {
    const wrapper = mount(OverviewPanel, { props: { title: 'Plain' } })

    expect(wrapper.text()).not.toContain('Live boards')
    expect(wrapper.text()).not.toContain('History table')
  })
})

describe('OverviewKpi', () => {
  it('renders label, value, unit, meta, source and slot', () => {
    const wrapper = mount(OverviewKpi, {
      props: {
        label: 'Time to a hire',
        value: 42,
        unit: 'days',
        meta: 'Last 4 quarters',
        source: 'history',
      },
      slots: { default: '<div class="split-slot">Split</div>' },
    })

    expect(wrapper.element.tagName).toBe('ARTICLE')
    expect(wrapper.text()).toContain('Time to a hire')
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('days')
    expect(wrapper.text()).toContain('Last 4 quarters')
    expect(wrapper.text()).toContain('History table')
    expect(wrapper.find('.split-slot').exists()).toBe(true)
  })

  it('shows the live tag and omits the unit when none is given', () => {
    const wrapper = mount(OverviewKpi, {
      props: { label: 'Open roles', value: '7', meta: 'Across 3 departments', source: 'live' },
    })

    expect(wrapper.text()).toContain('Live boards')
    expect(wrapper.find('.ov-kpi__unit').exists()).toBe(false)
  })
})

describe('useElementWidth', () => {
  it('returns the fallback when ResizeObserver is undefined', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const scope = effectScope()
    const width = scope.run(() => useElementWidth(ref<HTMLElement | null>(null), 500))

    expect(width?.value).toBe(500)
    scope.stop()
  })

  it('defaults the fallback to 640', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const scope = effectScope()
    const width = scope.run(() => useElementWidth(ref<HTMLElement | null>(null)))

    expect(width?.value).toBe(640)
    scope.stop()
  })

  it('follows ResizeObserver updates and disconnects with the scope', async () => {
    let callback: ResizeObserverCallback = () => undefined
    const disconnect = vi.fn<() => void>()
    const observe = vi.fn<(element: Element) => void>()
    class FakeObserver {
      constructor(cb: ResizeObserverCallback) {
        callback = cb
      }
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn<(element: Element) => void>()
    }
    vi.stubGlobal('ResizeObserver', FakeObserver)

    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 300, configurable: true })
    const target = ref<HTMLElement | null>(el)
    const scope = effectScope()
    const width = scope.run(() => useElementWidth(target, 640))

    await nextTick()
    expect(width?.value).toBe(300)
    expect(observe).toHaveBeenCalledWith(el)

    callback([{ contentRect: { width: 420 } } as ResizeObserverEntry], {} as ResizeObserver)
    expect(width?.value).toBe(420)

    scope.stop()
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('chart tooltip', () => {
  it('useChartTooltip outside a provider does not throw', () => {
    let api: ReturnType<typeof useChartTooltip> | undefined
    const wrapper = mount({
      setup() {
        api = useChartTooltip()
        return () => null
      },
    })

    expect(() => api?.show(new MouseEvent('mousemove'), 'Title', 'Text')).not.toThrow()
    expect(() => api?.hide()).not.toThrow()
    expect(api).toBeDefined()
    wrapper.unmount()
  })

  it('shows, clamps and hides the tooltip through a provider', async () => {
    const Child = {
      setup() {
        const tooltip = useChartTooltip()
        return () =>
          h('button', {
            onMouseenter: (event: MouseEvent) => tooltip.show(event, 'Design', '4 applicants'),
            onMouseleave: () => tooltip.hide(),
          })
      },
    }
    const Host = {
      setup() {
        provideChartTooltip()
        return () => h('div', [h(Child), h(ChartTooltip)])
      },
    }
    vi.stubGlobal('innerWidth', 1000)
    const wrapper = mount(Host)

    const tip = (): HTMLElement => wrapper.get('[role="tooltip"]').element as HTMLElement
    expect(tip().hasAttribute('hidden') || tip().dataset.active === 'false').toBe(true)

    await wrapper.get('button').trigger('mouseenter', { clientX: 980, clientY: 100 })
    expect(tip().dataset.active).toBe('true')
    expect(tip().textContent).toContain('Design')
    expect(tip().textContent).toContain('4 applicants')
    expect(Number.parseInt(tip().style.left, 10)).toBeLessThanOrEqual(1000 - 270)
    expect(Number.parseInt(tip().style.top, 10)).toBe(116)

    await wrapper.get('button').trigger('mouseleave')
    expect(tip().dataset.active).toBe('false')
  })
})
