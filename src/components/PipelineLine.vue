<script setup lang="ts">
import { computed } from 'vue'
import { useChartHover } from '@/lib/chart-tooltip'

const props = defineProps<{
  counts: number[]
  names: string[]
  label: string
}>()

const WIDTH = 150
const HEIGHT = 34
const hover = useChartHover()

const points = computed(() => {
  const count = props.counts.length
  const max = Math.max(1, ...props.counts)

  return props.counts.map((value, index) => ({
    x: count === 1 ? WIDTH / 2 : 6 + (index * (WIDTH - 12)) / (count - 1),
    y: HEIGHT - 5 - (value / max) * (HEIGHT - 12),
    last: index === count - 1,
  }))
})

const line = computed(() =>
  points.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
)

const area = computed(() => {
  const last = points.value[points.value.length - 1]
  const first = points.value[0]
  if (!first || !last || points.value.length < 2) {
    return ''
  }
  return `${first.x.toFixed(1)},${HEIGHT - 4} ${line.value} ${last.x.toFixed(1)},${HEIGHT - 4}`
})

const stages = computed(() =>
  props.counts.map((count, index) => ({ name: props.names[index] ?? `Stage ${index + 1}`, count })),
)

const tipText = computed(() => stages.value.map((s) => `${s.name} ${s.count}`).join(' · '))
</script>

<template>
  <span class="ov-pline">
    <svg
      class="ov-svg"
      role="img"
      font-size="12"
      :aria-label="`Applicants per stage for ${label}`"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      :width="WIDTH"
      :height="HEIGHT"
      v-bind="hover(label, tipText)"
    >
      <line class="ov-grid" x1="6" :x2="WIDTH - 6" :y1="HEIGHT - 4" :y2="HEIGHT - 4" />
      <polygon v-if="area" :points="area" class="ov-fill-accent" fill-opacity="0.12" />
      <polyline
        v-if="points.length > 1"
        :points="line"
        class="ov-stroke-accent"
        fill="none"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        v-for="(point, index) in points"
        :key="index"
        :cx="point.x"
        :cy="point.y"
        r="4"
        stroke-width="2"
        class="ov-stroke-accent"
        :class="point.last ? 'ov-fill-surface' : 'ov-fill-accent'"
      />
    </svg>
    <table class="sr-only">
      <caption>
        Applicants per stage for
        {{
          label
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Stage</th>
          <th scope="col">Applicants</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(stage, index) in stages" :key="index">
          <th scope="row">{{ stage.name }}</th>
          <td>{{ stage.count }}</td>
        </tr>
      </tbody>
    </table>
  </span>
</template>
