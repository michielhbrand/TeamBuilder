<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChartHover } from '@/lib/chart-tooltip'
import { barPath, niceTicks, thinStep } from '@/lib/chart-scale'
import { formatCount, type QuarterPoint } from '@/lib/overview'
import { useElementWidth } from '@/lib/use-element-width'

const props = defineProps<{
  points: QuarterPoint[]
  kind: 'decisions' | 'applicants'
  emptyText?: string
}>()

const HEIGHT = 220
const TOP = 10
const BOTTOM = 30
const MIN_LEFT = 34
const GAP = 2

const wrapper = ref<HTMLElement | null>(null)
const width = useElementWidth(wrapper)
const hover = useChartHover()

function total(point: QuarterPoint): number {
  return props.kind === 'decisions' ? point.hired + point.rejected : point.applicantsIn
}

const empty = computed(() => props.points.every((point) => total(point) === 0))

const axis = computed(() => niceTicks(Math.max(0, ...props.points.map(total))))
const left = computed(() => {
  const longest = Math.max(...axis.value.ticks.map((tick) => formatCount(tick).length))
  return Math.max(MIN_LEFT, longest * 7 + 12)
})

const baseline = HEIGHT - BOTTOM
const plotHeight = HEIGHT - TOP - BOTTOM

function yFor(value: number): number {
  return TOP + plotHeight * (1 - value / axis.value.top)
}

const band = computed(() => (width.value - left.value) / Math.max(1, props.points.length))
const labelStep = computed(() => thinStep(band.value, 46))

function tooltipText(point: QuarterPoint): string {
  if (props.kind === 'applicants') {
    return `${formatCount(point.applicantsIn)} applicants came in`
  }
  const decided = point.hired + point.rejected
  const share = decided > 0 ? Math.round((point.hired / decided) * 100) : 0
  return `${formatCount(point.hired)} hired · ${formatCount(point.rejected)} rejected (${share}% hired)`
}

const bars = computed(() =>
  props.points.map((point, index) => {
    const barLeft = left.value + index * band.value
    const barWidth = Math.min(40, Math.max(8, band.value * 0.56))
    const x = barLeft + (band.value - barWidth) / 2
    const segments: { d: string; tone: 'hired' | 'rejected' | 'applicants' }[] = []

    if (props.kind === 'applicants') {
      const height = baseline - yFor(point.applicantsIn)
      if (height > 0) {
        segments.push({
          d: barPath(x, baseline - height, barWidth, height, true),
          tone: 'applicants',
        })
      }
    } else {
      const hiredHeight = baseline - yFor(point.hired)
      const rejectedHeight = baseline - yFor(point.rejected)
      const stacked = hiredHeight > 0 && rejectedHeight > 0
      if (hiredHeight > 0) {
        segments.push({
          d: barPath(x, baseline - hiredHeight, barWidth, hiredHeight, !stacked),
          tone: 'hired',
        })
      }
      if (rejectedHeight > 0) {
        const height = Math.max(1, rejectedHeight - (stacked ? GAP : 0))
        const y = baseline - hiredHeight - (stacked ? GAP : 0) - height
        segments.push({ d: barPath(x, y, barWidth, height, true), tone: 'rejected' })
      }
    }

    return {
      key: point.key,
      left: barLeft,
      center: x + barWidth / 2,
      label: `${point.label}${point.partial ? '*' : ''}`,
      showLabel: (props.points.length - 1 - index) % labelStep.value === 0,
      segments,
      title: `${point.label}${point.partial ? ' (so far)' : ''}`,
      text: tooltipText(point),
    }
  }),
)

const summary = computed(
  () =>
    `${props.kind === 'decisions' ? 'Hired and rejected per quarter' : 'Applicants in per quarter'}, ${props.points.length} ${props.points.length === 1 ? 'quarter' : 'quarters'}`,
)
</script>

<template>
  <div ref="wrapper" class="ov-chart">
    <p v-if="empty" class="ov-empty">{{ emptyText ?? 'No history recorded yet.' }}</p>
    <template v-else>
      <svg
        class="ov-svg"
        role="img"
        font-size="12"
        :aria-label="summary"
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        :width="width"
        :height="HEIGHT"
      >
        <g v-for="tick in axis.ticks" :key="tick">
          <line class="ov-grid" :x1="left" :x2="width" :y1="yFor(tick)" :y2="yFor(tick)" />
          <text :x="left - 6" :y="yFor(tick) + 4" text-anchor="end">{{ formatCount(tick) }}</text>
        </g>
        <g v-for="bar in bars" :key="bar.key" class="ov-qbar" v-bind="hover(bar.title, bar.text)">
          <rect class="ov-hit" :x="bar.left" :y="TOP" :width="band" :height="plotHeight" />
          <path
            v-for="segment in bar.segments"
            :key="segment.tone"
            :d="segment.d"
            :class="
              segment.tone === 'rejected'
                ? 'ov-fill-line-input'
                : segment.tone === 'hired'
                  ? 'ov-fill-signal'
                  : 'ov-fill-accent'
            "
          />
        </g>
        <template v-for="bar in bars" :key="`label-${bar.key}`">
          <text v-if="bar.showLabel" :x="bar.center" :y="HEIGHT - 10" text-anchor="middle">
            {{ bar.label }}
          </text>
        </template>
      </svg>
      <table class="sr-only">
        <caption>
          {{
            summary
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Quarter</th>
            <template v-if="kind === 'decisions'">
              <th scope="col">Hired</th>
              <th scope="col">Rejected</th>
            </template>
            <th v-else scope="col">Applicants in</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="point in points" :key="point.key">
            <th scope="row">{{ point.label }}{{ point.partial ? ' (so far)' : '' }}</th>
            <template v-if="kind === 'decisions'">
              <td>{{ formatCount(point.hired) }}</td>
              <td>{{ formatCount(point.rejected) }}</td>
            </template>
            <td v-else>{{ formatCount(point.applicantsIn) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
