<script setup lang="ts">
import { computed } from 'vue'
import { useChartHover } from '@/lib/chart-tooltip'

interface BarRow {
  name: string
  value: number | null
  unit?: string
  tip?: string
}

const props = defineProps<{ rows: BarRow[] }>()

const hover = useChartHover()
const max = computed(() => Math.max(0, ...props.rows.map((row) => row.value ?? 0)))

function unitFor(row: BarRow): string {
  return row.value === 1 && row.unit ? row.unit.replace(/s$/, '') : (row.unit ?? '')
}

function valueText(row: BarRow): string {
  return row.value === null ? '–' : `${row.value}${row.unit ? ` ${unitFor(row)}` : ''}`
}

function widthFor(row: BarRow): number {
  return max.value > 0 && row.value !== null ? (row.value / max.value) * 100 : 0
}

function tipFor(row: BarRow): string {
  if (row.tip) {
    return row.tip
  }
  if (row.value === null || (row.unit && row.value === 0)) {
    return 'nobody here'
  }
  if (row.unit) {
    return `median ${row.value} ${unitFor(row)}`
  }
  return `${row.value} active applicant${row.value === 1 ? '' : 's'}`
}

const summary = computed(
  () => `Values by stage: ${props.rows.map((row) => `${row.name} ${valueText(row)}`).join(', ')}`,
)
</script>

<template>
  <div class="ov-chart">
    <div class="ov-hbars" role="img" :aria-label="summary">
      <div
        v-for="row in rows"
        :key="row.name"
        class="ov-hbars__row"
        v-bind="hover(row.name, tipFor(row))"
      >
        <span class="ov-hbars__name" :title="row.name">{{ row.name }}</span>
        <span class="ov-hbars__track">
          <i class="ov-hbars__fill" :style="{ width: `${widthFor(row)}%` }" />
        </span>
        <b class="ov-hbars__value">{{ valueText(row) }}</b>
      </div>
    </div>
    <table class="sr-only">
      <caption>
        Value per stage
      </caption>
      <thead>
        <tr>
          <th scope="col">Stage</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <th scope="row">{{ row.name }}</th>
          <td>{{ valueText(row) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
