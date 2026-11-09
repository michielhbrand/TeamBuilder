<script setup lang="ts">
import { computed } from 'vue'

interface DepartmentLoadRow {
  department: string
  active: number
  openPositions: number
  overdue: number
}

const props = defineProps<{
  rows: DepartmentLoadRow[]
  selected: string
}>()

const emit = defineEmits<{
  select: [department: string]
}>()

const maxValue = computed(() =>
  Math.max(1, ...props.rows.flatMap((row) => [row.active, row.openPositions])),
)

function barWidth(value: number): string {
  if (value === 0) {
    return '0%'
  }

  return `${Math.max(4, (value / maxValue.value) * 100)}%`
}
</script>

<template>
  <div class="department-chart">
    <button
      v-for="row in rows"
      :key="row.department"
      class="department-chart__row"
      :class="{ 'department-chart__row--selected': selected === row.department }"
      type="button"
      :aria-pressed="selected === row.department"
      :aria-label="`Show ${row.department}: ${row.active} active candidates and ${row.openPositions} open positions`"
      @click="emit('select', row.department)"
    >
      <span class="department-chart__identity">
        <span class="department-chart__name">{{ row.department }}</span>
        <span class="department-meta">
          {{ row.active }} active &middot; {{ row.openPositions }} open
        </span>
      </span>

      <span class="department-chart__bars" aria-hidden="true">
        <span class="department-chart__track">
          <span
            class="department-chart__bar department-chart__bar--open"
            :style="{ width: barWidth(row.openPositions) }"
          />
        </span>
        <span class="department-chart__track">
          <span
            class="department-chart__bar department-chart__bar--active"
            :style="{ width: barWidth(row.active) }"
          />
        </span>
      </span>

      <span v-if="row.overdue" class="department-chart__late">
        {{ row.overdue }} past deadline
      </span>
      <span v-else class="department-chart__clear">On track</span>
    </button>
  </div>
</template>
