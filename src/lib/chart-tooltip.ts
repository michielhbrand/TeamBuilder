import { inject, provide, reactive, type InjectionKey } from 'vue'

export interface ChartTooltipState {
  active: boolean
  title: string
  text: string
  x: number
  y: number
}

export interface ChartTooltipApi {
  show(event: PointerEvent | MouseEvent, title: string, text: string): void
  hide(): void
}

interface ChartTooltipContext {
  state: ChartTooltipState
  api: ChartTooltipApi
}

export const TOOLTIP_OFFSET_X = 14
export const TOOLTIP_OFFSET_Y = 16
export const TOOLTIP_MAX_WIDTH = 260
const VIEWPORT_MARGIN = 10

const chartTooltipKey: InjectionKey<ChartTooltipContext> = Symbol('chart-tooltip')

const noop: ChartTooltipApi = { show: () => undefined, hide: () => undefined }

export function clampTooltipLeft(clientX: number, viewportWidth: number): number {
  const max = viewportWidth - TOOLTIP_MAX_WIDTH - VIEWPORT_MARGIN
  return Math.max(VIEWPORT_MARGIN, Math.min(clientX + TOOLTIP_OFFSET_X, max))
}

export function provideChartTooltip(): void {
  const state = reactive<ChartTooltipState>({ active: false, title: '', text: '', x: 0, y: 0 })
  const api: ChartTooltipApi = {
    show(event, title, text) {
      state.title = title
      state.text = text
      state.x = clampTooltipLeft(event.clientX, window.innerWidth)
      state.y = event.clientY + TOOLTIP_OFFSET_Y
      state.active = true
    },
    hide() {
      state.active = false
    },
  }
  provide(chartTooltipKey, { state, api })
}

export function useChartTooltip(): ChartTooltipApi {
  return inject(chartTooltipKey, null)?.api ?? noop
}

export function useChartTooltipState(): ChartTooltipState | null {
  return inject(chartTooltipKey, null)?.state ?? null
}
