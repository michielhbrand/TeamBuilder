<script setup lang="ts">
import { computed } from 'vue'

type OutcomeKey = 'active' | 'hired' | 'rejected'

interface OutcomeRow {
  key: OutcomeKey
  label: string
  value: number
  percent: number
}

const props = defineProps<{
  active: number
  hired: number
  rejected: number
}>()

const radius = 48
const circumference = 2 * Math.PI * radius

const total = computed(() => props.active + props.hired + props.rejected)

const rows = computed<OutcomeRow[]>(() => {
  const values: Array<[OutcomeKey, string, number]> = [
    ['active', 'Active', props.active],
    ['hired', 'Hired', props.hired],
    ['rejected', 'Rejected', props.rejected],
  ]

  return values.map(([key, label, value]) => ({
    key,
    label,
    value,
    percent: total.value ? Math.round((value / total.value) * 100) : 0,
  }))
})

const segments = computed(() => {
  let consumed = 0

  return rows.value
    .filter((row) => row.value > 0)
    .map((row) => {
      const fraction = row.value / total.value
      const segment = {
        ...row,
        dash: `${fraction * circumference} ${circumference}`,
        offset: `${-consumed * circumference}`,
      }

      consumed += fraction
      return segment
    })
})

const summary = computed(() =>
  rows.value.map((row) => `${row.value} ${row.label.toLowerCase()}`).join(', '),
)
</script>

<template>
  <p v-if="!total" class="overview-empty">No candidates in this scope yet.</p>

  <div v-else class="outcome-donut">
    <div class="outcome-donut__chart-wrap">
      <svg
        class="outcome-donut__chart"
        viewBox="0 0 120 120"
        role="img"
        :aria-label="`Candidate outcomes: ${summary}`"
      >
        <circle
          class="outcome-donut__track"
          cx="60"
          cy="60"
          :r="radius"
          transform="rotate(-90 60 60)"
        />
        <circle
          v-for="segment in segments"
          :key="segment.key"
          class="outcome-donut__segment"
          :class="`outcome-donut__segment--${segment.key}`"
          cx="60"
          cy="60"
          :r="radius"
          :stroke-dasharray="segment.dash"
          :stroke-dashoffset="segment.offset"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span class="outcome-donut__center">
        <strong>{{ total }}</strong>
        <span>{{ total === 1 ? 'candidate' : 'candidates' }}</span>
      </span>
    </div>

    <ul class="outcome-donut__legend">
      <li v-for="row in rows" :key="row.key">
        <span
          class="outcome-donut__swatch"
          :class="`outcome-donut__swatch--${row.key}`"
          aria-hidden="true"
        />
        <span>{{ row.label }}</span>
        <span class="outcome-donut__value">{{ row.value }} &middot; {{ row.percent }}%</span>
      </li>
    </ul>
  </div>
</template>
