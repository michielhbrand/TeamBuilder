<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChartHover } from '@/lib/chart-tooltip'
import { axisMaxDays, dayTickStep, niceTicks, thinStep, truncateLabel } from '@/lib/chart-scale'
import {
  medianByQuarter,
  percentile,
  quarterKey,
  quarterLabel,
  rangeByDepartment,
  speedCurve,
} from '@/lib/overview'
import { useElementWidth } from '@/lib/use-element-width'
import type { HireRecord } from '@/types/history'

const props = defineProps<{
  hires: HireRecord[]
  departments: string[]
  view: 'strip' | 'range' | 'curve' | 'trend'
  quarters: string[]
  partialKey?: string
}>()

const RIGHT = 48
const AXIS_BAND = 34
const STRIP_ROW = 52
const RANGE_ROW = 44
const PLOT_TOP = 6
const CURVE_HEIGHT = 250
const TREND_HEIGHT = 230
const TREND_TOP = 22

const wrapper = ref<HTMLElement | null>(null)
const width = useElementWidth(wrapper)
const hover = useChartHover()

const isRows = computed(() => props.view === 'strip' || props.view === 'range')
const left = computed(() => {
  if (isRows.value) {
    return Math.round(Math.min(150, Math.max(84, width.value * 0.26)))
  }
  return props.view === 'curve' ? 46 : 52
})
const plotWidth = computed(() => Math.max(40, width.value - left.value - RIGHT))
const maxDays = computed(() => axisMaxDays(props.hires.map((hire) => hire.daysToHire)))

function xFor(days: number): number {
  return left.value + (plotWidth.value * days) / maxDays.value
}

const dayTicks = computed(() => {
  const step = dayTickStep(plotWidth.value / maxDays.value)
  const ticks: number[] = []
  for (let day = 0; day <= maxDays.value; day += step) {
    ticks.push(day)
  }
  return ticks
})

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function round(value: number): number {
  return Math.round(value)
}

const ranges = computed(() => rangeByDepartment(props.hires))

const rows = computed(() =>
  props.departments.map((department, index) => {
    const range = ranges.value.find((entry) => entry.department === department)
    const rowHeight = props.view === 'strip' ? STRIP_ROW : RANGE_ROW
    const cy = PLOT_TOP + index * rowHeight + rowHeight / 2
    const dots = props.hires
      .filter((hire) => hire.department === department)
      .map((hire, k) => ({
        id: hire.applicantId,
        x: xFor(hire.daysToHire),
        y: cy + (((k * 7) % 5) - 2) * 5,
        title: department,
        text: `${plural(hire.daysToHire, 'day')} · ${quarterLabel(quarterKey(hire.hiredOn))}`,
      }))

    return {
      department,
      name: truncateLabel(department, left.value - 12),
      cy,
      range,
      dots,
      count: range?.count ?? 0,
    }
  }),
)

const rowsHeight = computed(
  () =>
    Math.max(1, props.departments.length) * (props.view === 'strip' ? STRIP_ROW : RANGE_ROW) +
    AXIS_BAND +
    PLOT_TOP,
)

const curve = computed(() => {
  const plotTop = 10
  const plotBottom = CURVE_HEIGHT - AXIS_BAND
  const yFor = (share: number) => plotTop + (plotBottom - plotTop) * (1 - share)
  const steps = speedCurve(props.hires)
  const points = [`${xFor(0)},${yFor(0)}`]
  let previous = 0
  for (const step of steps) {
    points.push(`${xFor(step.days)},${yFor(previous)}`, `${xFor(step.days)},${yFor(step.share)}`)
    previous = step.share
  }
  points.push(`${xFor(maxDays.value)},${yFor(1)}`)

  const days = props.hires.map((hire) => hire.daysToHire)
  const markers = (
    [
      [0.5, 'half'],
      [0.9, '9 in 10'],
    ] as const
  ).map(([share, name]) => {
    const value = round(percentile(days, share) as number)
    const text = `${name} within ${value} days`
    const x = xFor(value)
    const flip = x + 10 + text.length * 6.8 > width.value
    return {
      share,
      x,
      y: yFor(share),
      base: yFor(0),
      text,
      flip,
      title: `${name} of hires`,
      tip: `made within ${plural(value, 'day')}`,
    }
  })

  return {
    points: points.join(' '),
    markers,
    yFor,
    shares: [0, 0.25, 0.5, 0.75, 1],
  }
})

const trend = computed(() => {
  const medians = medianByQuarter(props.hires, props.quarters)
  const known = medians.filter((entry) => entry.median !== null)
  const axis = niceTicks(Math.max(0, ...known.map((entry) => entry.median as number)) * 1.1)
  const plotBottom = TREND_HEIGHT - AXIS_BAND
  const yFor = (value: number) => TREND_TOP + (plotBottom - TREND_TOP) * (1 - value / axis.top)
  const inset = 18
  const spacing =
    medians.length > 1 ? (plotWidth.value - inset * 2) / (medians.length - 1) : plotWidth.value
  const xAt = (index: number) =>
    medians.length === 1 ? left.value + plotWidth.value / 2 : left.value + inset + spacing * index
  const labelStep = thinStep(spacing, 50)
  const points = medians.map((entry, index) => ({
    key: entry.key,
    label: quarterLabel(entry.key),
    partial: entry.key === props.partialKey,
    median: entry.median === null ? null : round(entry.median),
    x: xAt(index),
    y: entry.median === null ? 0 : yFor(entry.median),
    showLabel: index % labelStep === 0,
  }))

  return {
    axis,
    yFor,
    points,
    known: points.filter((point) => point.median !== null),
    showValues: spacing >= 28,
    line: points
      .filter((point) => point.median !== null)
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  }
})

const empty = computed(
  () => props.hires.length === 0 || (props.view === 'trend' && trend.value.known.length === 0),
)

const height = computed(() => {
  if (props.view === 'curve') return CURVE_HEIGHT
  if (props.view === 'trend') return TREND_HEIGHT
  return rowsHeight.value
})

const summary = computed(() => {
  switch (props.view) {
    case 'strip':
      return `Each hire as a dot, by days from board opened to hire, ${props.hires.length} hires`
    case 'range':
      return `Typical range of days to hire by department, ${ranges.value.length} departments`
    case 'curve':
      return `Share of hires made within a number of days, ${props.hires.length} hires`
    default:
      return `Median days to hire per quarter, ${trend.value.known.length} quarters with hires`
  }
})

const curveRows = computed(() =>
  [0.25, 0.5, 0.75, 0.9, 1].map((share) => ({
    share,
    days: round(
      percentile(
        props.hires.map((hire) => hire.daysToHire),
        share,
      ) as number,
    ),
  })),
)
</script>

<template>
  <div ref="wrapper" class="ov-chart">
    <p v-if="empty" class="ov-empty">No hires in this range.</p>
    <template v-else>
      <svg
        class="ov-svg"
        role="img"
        font-size="12"
        :aria-label="summary"
        :viewBox="`0 0 ${width} ${height}`"
        :width="width"
        :height="height"
      >
        <template v-if="isRows">
          <g v-for="tick in dayTicks" :key="tick">
            <line
              class="ov-grid"
              :x1="xFor(tick)"
              :x2="xFor(tick)"
              :y1="PLOT_TOP"
              :y2="height - AXIS_BAND + 10"
            />
            <text :x="xFor(tick)" :y="height - 8" text-anchor="middle">{{ tick }} days</text>
          </g>
          <g v-for="row in rows" :key="row.department">
            <text class="ov-strong" x="0" :y="row.cy + (view === 'strip' ? 0 : 4)">
              {{ row.name }}
            </text>
            <text v-if="view === 'strip'" x="0" :y="row.cy + 16">
              {{ plural(row.count, 'hire') }}
            </text>
            <template v-if="view === 'strip'">
              <g
                v-for="dot in row.dots"
                :key="dot.id"
                class="ov-dot-group"
                v-bind="hover(dot.title, dot.text)"
              >
                <circle class="ov-hit" :cx="dot.x" :cy="dot.y" r="9" />
                <circle
                  class="ov-dot ov-fill-accent ov-stroke-surface"
                  fill-opacity="0.7"
                  stroke-width="1.5"
                  :cx="dot.x"
                  :cy="dot.y"
                  r="5"
                />
              </g>
              <g
                v-if="row.range"
                v-bind="hover(`${row.department} median`, plural(round(row.range.median), 'day'))"
              >
                <line
                  class="ov-hit"
                  :x1="xFor(row.range.median)"
                  :x2="xFor(row.range.median)"
                  :y1="row.cy - 18"
                  :y2="row.cy + 18"
                  stroke="transparent"
                  stroke-width="12"
                />
                <line
                  class="ov-stroke-ink"
                  stroke-width="2"
                  stroke-linecap="round"
                  :x1="xFor(row.range.median)"
                  :x2="xFor(row.range.median)"
                  :y1="row.cy - 16"
                  :y2="row.cy + 16"
                />
              </g>
            </template>
            <g
              v-else-if="row.range"
              v-bind="
                hover(
                  row.department,
                  `Fastest ${row.range.min} · typical ${round(row.range.q1)} to ${round(row.range.q3)} · median ${round(row.range.median)} · slowest ${row.range.max} days`,
                )
              "
            >
              <rect
                class="ov-hit"
                :x="xFor(row.range.min) - 6"
                :y="row.cy - 14"
                :width="xFor(row.range.max) - xFor(row.range.min) + 12"
                height="28"
              />
              <line
                class="ov-stroke-line-input"
                stroke-width="2"
                :x1="xFor(row.range.min)"
                :x2="xFor(row.range.max)"
                :y1="row.cy"
                :y2="row.cy"
              />
              <rect
                class="ov-fill-accent"
                fill-opacity="0.35"
                rx="4"
                height="18"
                :x="xFor(row.range.q1)"
                :y="row.cy - 9"
                :width="Math.max(2, xFor(row.range.q3) - xFor(row.range.q1))"
              />
              <circle
                class="ov-fill-accent ov-stroke-surface"
                stroke-width="2"
                r="6"
                :cx="xFor(row.range.median)"
                :cy="row.cy"
              />
              <text :x="xFor(row.range.max) + 8" :y="row.cy + 4">
                {{ round(row.range.median) }} d
              </text>
            </g>
          </g>
        </template>

        <template v-else-if="view === 'curve'">
          <g v-for="share in curve.shares" :key="share">
            <line
              class="ov-grid"
              :x1="left"
              :x2="width - RIGHT + 24"
              :y1="curve.yFor(share)"
              :y2="curve.yFor(share)"
            />
            <text :x="left - 8" :y="curve.yFor(share) + 4" text-anchor="end">
              {{ Math.round(share * 100) }}%
            </text>
          </g>
          <text
            v-for="tick in dayTicks"
            :key="tick"
            :x="xFor(tick)"
            :y="height - 12"
            text-anchor="middle"
          >
            {{ tick }} days
          </text>
          <polyline
            class="ov-stroke-accent"
            fill="none"
            stroke-width="2"
            stroke-linejoin="round"
            :points="curve.points"
          />
          <g v-for="marker in curve.markers" :key="marker.share">
            <g v-bind="hover(marker.title, marker.tip)">
              <rect
                class="ov-hit"
                :x="marker.x - 10"
                :y="marker.y - 10"
                width="20"
                :height="marker.base - marker.y + 10"
              />
              <line
                class="ov-stroke-ink"
                stroke-width="2"
                :x1="marker.x"
                :x2="marker.x"
                :y1="marker.y"
                :y2="marker.base"
              />
              <circle class="ov-fill-ink" r="5" :cx="marker.x" :cy="marker.y" />
            </g>
            <text
              class="ov-strong"
              :x="marker.flip ? marker.x - 10 : marker.x + 10"
              :y="marker.y + 4"
              :text-anchor="marker.flip ? 'end' : 'start'"
            >
              {{ marker.text }}
            </text>
          </g>
        </template>

        <template v-else>
          <g v-for="tick in trend.axis.ticks" :key="tick">
            <line
              class="ov-grid"
              :x1="left"
              :x2="width - RIGHT + 24"
              :y1="trend.yFor(tick)"
              :y2="trend.yFor(tick)"
            />
            <text :x="left - 8" :y="trend.yFor(tick) + 4" text-anchor="end">{{ tick }} d</text>
          </g>
          <polyline
            class="ov-stroke-accent"
            fill="none"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            :points="trend.line"
          />
          <g v-for="point in trend.points" :key="point.key">
            <g
              v-if="point.median !== null"
              v-bind="
                hover(
                  `${point.label}${point.partial ? ' (so far)' : ''}`,
                  `Median ${plural(point.median, 'day')} to hire`,
                )
              "
            >
              <circle class="ov-hit" r="14" :cx="point.x" :cy="point.y" />
              <circle
                class="ov-fill-accent ov-stroke-surface"
                stroke-width="2"
                r="5"
                :cx="point.x"
                :cy="point.y"
              />
            </g>
            <text
              v-if="point.median !== null && trend.showValues"
              class="ov-strong"
              text-anchor="middle"
              :x="point.x"
              :y="point.y - 11"
            >
              {{ point.median }}
            </text>
            <text v-if="point.showLabel" text-anchor="middle" :x="point.x" :y="height - 8">
              {{ point.label }}{{ point.partial ? '*' : '' }}
            </text>
          </g>
        </template>
      </svg>

      <table class="sr-only">
        <caption>
          {{
            summary
          }}
        </caption>
        <template v-if="view === 'strip' || view === 'range'">
          <thead>
            <tr>
              <th scope="col">Department</th>
              <th scope="col">Hires</th>
              <th scope="col">Fastest (days)</th>
              <th scope="col">Typical low (days)</th>
              <th scope="col">Median (days)</th>
              <th scope="col">Typical high (days)</th>
              <th scope="col">Slowest (days)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="range in ranges" :key="range.department">
              <th scope="row">{{ range.department }}</th>
              <td>{{ range.count }}</td>
              <td>{{ range.min }}</td>
              <td>{{ round(range.q1) }}</td>
              <td>{{ round(range.median) }}</td>
              <td>{{ round(range.q3) }}</td>
              <td>{{ range.max }}</td>
            </tr>
          </tbody>
        </template>
        <template v-else-if="view === 'curve'">
          <thead>
            <tr>
              <th scope="col">Share of hires</th>
              <th scope="col">Made within (days)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in curveRows" :key="entry.share">
              <th scope="row">{{ Math.round(entry.share * 100) }}%</th>
              <td>{{ entry.days }}</td>
            </tr>
          </tbody>
        </template>
        <template v-else>
          <thead>
            <tr>
              <th scope="col">Quarter</th>
              <th scope="col">Median days to hire</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in trend.points" :key="point.key">
              <th scope="row">{{ point.label }}{{ point.partial ? ' (so far)' : '' }}</th>
              <td>{{ point.median ?? '–' }}</td>
            </tr>
          </tbody>
        </template>
      </table>
    </template>
  </div>
</template>
