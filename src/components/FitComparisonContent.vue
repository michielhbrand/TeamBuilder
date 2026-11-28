<script setup lang="ts">
import { computed } from 'vue'
import FitComparisonChart from '@/components/FitComparisonChart.vue'
import {
  FIT_WEIGHT_KEYS,
  type FitComparisonMode,
  type FitComparisonRow,
  type FitComparisonSelection,
} from '@/lib/fit-compare'
import type { FitWeightKey } from '@/types/fit'

const props = defineProps<{
  rows: FitComparisonRow[]
  mode: FitComparisonMode
  selection: FitComparisonSelection
  excludedCount: number
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  'update:mode': [mode: FitComparisonMode]
  'update:selection': [selection: FitComparisonSelection]
  'open-applicant': [applicantId: string]
}>()

const groupLabels: Record<FitWeightKey, string> = {
  minimum: 'Minimum',
  recommended: 'Recommended',
  skills: 'Skills',
}

const comparableCount = computed(() => props.rows.filter((row) => row.comparable).length)

const excludedText = computed(() => {
  if (!props.excludedCount) {
    return ''
  }

  return `${props.excludedCount} active ${props.excludedCount === 1 ? 'applicant is' : 'applicants are'} not analyzed or incomplete and not shown.`
})

function toggle(key: FitWeightKey): void {
  emit('update:selection', { ...props.selection, [key]: !props.selection[key] })
}

function setMode(mode: FitComparisonMode): void {
  emit('update:mode', mode)
}
</script>

<template>
  <div class="fit-compare">
    <div class="fit-compare-controls">
      <div class="fit-compare-toggle" role="group" aria-label="Fit groups">
        <button
          v-for="key in FIT_WEIGHT_KEYS"
          :key="key"
          class="ov-chip"
          type="button"
          :aria-pressed="selection[key]"
          @click="toggle(key)"
        >
          {{ groupLabels[key] }}
        </button>
      </div>

      <div class="fit-compare-toggle" role="group" aria-label="Ordering">
        <button
          class="ov-chip"
          type="button"
          :aria-pressed="mode === 'default'"
          @click="setMode('default')"
        >
          Default
        </button>
        <button
          class="ov-chip"
          type="button"
          :aria-pressed="mode === 'custom'"
          @click="setMode('custom')"
        >
          Custom weights
        </button>
      </div>
    </div>

    <div class="fit-compare-legend" aria-label="Legend">
      <span class="fit-compare-legend__item">
        <i class="fit-compare-swatch fit-compare-swatch--minimum" aria-hidden="true" />Minimum
      </span>
      <span class="fit-compare-legend__item">
        <i
          class="fit-compare-swatch fit-compare-swatch--recommended"
          aria-hidden="true"
        />Recommended
      </span>
      <span class="fit-compare-legend__item">
        <i class="fit-compare-swatch fit-compare-swatch--skills" aria-hidden="true" />Skills
      </span>
    </div>

    <p class="meta fit-compare-note">
      <template v-if="mode === 'default'">
        Default order compares Minimum first, then Recommended, then Skills. Candidates with a
        missed minimum rank after those without.
      </template>
      <template v-else>
        Custom weights order this chart by weighted fit; a missed minimum does not gate the order.
      </template>
      Stage columns stay minimum-first.
    </p>

    <p v-if="loading" class="fit-compare-empty">Loading CV analyses…</p>
    <p v-else-if="error" class="fit-compare-empty">{{ error }}</p>
    <p v-else-if="!rows.length" class="fit-compare-empty">
      No complete CV analyses yet. Analyze a CV to compare applicants.
    </p>
    <p v-else-if="!comparableCount" class="fit-compare-empty">
      Select at least one group with requirements to compare fit.
    </p>
    <FitComparisonChart
      v-else
      :rows="rows"
      :mode="mode"
      :selection="selection"
      @open-applicant="emit('open-applicant', $event)"
    />

    <p v-if="excludedText" class="meta fit-compare-excluded">{{ excludedText }}</p>
  </div>
</template>
