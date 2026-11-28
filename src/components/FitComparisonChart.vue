<script setup lang="ts">
import { computed } from 'vue'
import { useChartHover } from '@/lib/chart-tooltip'
import {
  FIT_WEIGHT_KEYS,
  type FitComparisonMode,
  type FitComparisonRow,
  type FitComparisonSelection,
} from '@/lib/fit-compare'
import type { FitRequirementCounts } from '@/lib/fit-rank'
import type { FitWeightKey } from '@/types/fit'

const props = defineProps<{
  rows: FitComparisonRow[]
  mode: FitComparisonMode
  selection: FitComparisonSelection
}>()

const emit = defineEmits<{
  'open-applicant': [applicantId: string]
}>()

const hover = useChartHover()

const groupLabels: Record<FitWeightKey, string> = {
  minimum: 'Minimum',
  recommended: 'Recommended',
  skills: 'Skills',
}

const visibleKeys = computed(() => FIT_WEIGHT_KEYS.filter((key) => props.selection[key]))

const chartLabel = computed(() => {
  const mode = props.mode === 'weighted' ? 'Weighted fit' : 'Unweighted fit'
  const values = props.rows
    .map(
      (row) => `${row.name} ${row.total === null ? 'not comparable' : `${Math.round(row.total)}%`}`,
    )
    .join(', ')

  return `${mode} comparison for ${props.rows.length} applicants: ${values}`
})

function percent(value: number | null): string {
  return value === null ? '–' : `${Math.round(value)}%`
}

function barHeight(row: FitComparisonRow, key: FitWeightKey): string {
  const share = row.shares[key]

  return share === null ? '2px' : `${share * 100}%`
}

function countLabel(counts: FitRequirementCounts): string {
  return counts.total ? `${counts.full}/${counts.total}` : '–'
}

function tooltipText(row: FitComparisonRow, key: FitWeightKey): string {
  const counts = row.summary[key]

  if (!counts.total) {
    return 'No requirements in this group.'
  }

  const parts = [`${counts.full} of ${counts.total} met`]

  if (counts.partial) {
    parts.push(`${counts.partial} partial`)
  }

  if (counts.none) {
    parts.push(`${counts.none} not shown`)
  }

  return `${parts.join(' · ')} · ${percent(row.shares[key])}`
}

function openLabel(row: FitComparisonRow): string {
  const total =
    row.total === null
      ? 'not comparable'
      : `${props.mode === 'weighted' ? 'weighted' : 'unweighted'} fit ${Math.round(row.total)}%`

  return `Open ${row.name}, ${row.stageName}, ${total}`
}

function cellValue(row: FitComparisonRow, key: FitWeightKey): string {
  if (!props.selection[key]) {
    return 'Not selected'
  }

  return percent(row.shares[key])
}
</script>

<template>
  <div class="fit-compare-chart">
    <div class="fit-compare-axis" aria-hidden="true">
      <span>100%</span>
      <span>50%</span>
      <span>0%</span>
    </div>

    <div class="fit-compare-scroll">
      <div class="fit-compare-plot">
        <div class="fit-compare-grid" aria-hidden="true">
          <span class="fit-compare-grid__line fit-compare-grid__line--top" />
          <span class="fit-compare-grid__line fit-compare-grid__line--mid" />
          <span class="fit-compare-grid__line fit-compare-grid__line--bottom" />
        </div>

        <ul class="fit-compare-clusters" :aria-label="chartLabel">
          <li v-for="row in rows" :key="row.applicantId" class="fit-compare-cluster">
            <button
              type="button"
              class="fit-compare-cluster__button"
              :aria-label="openLabel(row)"
              @click="emit('open-applicant', row.applicantId)"
            >
              <span class="fit-compare-cluster__bars">
                <span
                  v-for="key in visibleKeys"
                  :key="key"
                  class="fit-compare-bar-wrap"
                  v-bind="hover(`${row.name} · ${groupLabels[key]}`, tooltipText(row, key))"
                >
                  <span
                    class="fit-compare-bar"
                    :class="[
                      `fit-compare-bar--${key}`,
                      { 'fit-compare-bar--empty': row.shares[key] === null },
                    ]"
                    :style="{ height: barHeight(row, key) }"
                  />
                </span>
              </span>

              <span class="fit-compare-cluster__value">{{ percent(row.total) }}</span>
              <span class="fit-compare-cluster__name">{{ row.name }}</span>
              <span class="fit-compare-cluster__stage">{{ row.stageName }}</span>
              <span class="fit-compare-cluster__counts">
                <span v-for="key in visibleKeys" :key="key" class="fit-compare-count">
                  <span class="sr-only">{{ groupLabels[key] }}</span>
                  {{ countLabel(row.summary[key]) }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <table class="sr-only">
      <caption>
        {{
          mode === 'weighted' ? 'Weighted' : 'Unweighted'
        }}
        fit comparison
      </caption>
      <thead>
        <tr>
          <th scope="col">Applicant</th>
          <th scope="col">Stage</th>
          <th scope="col">Minimum</th>
          <th scope="col">Recommended</th>
          <th scope="col">Skills</th>
          <th scope="col">Fit</th>
          <th scope="col">Minimum missed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.applicantId">
          <th scope="row">{{ row.name }}</th>
          <td>{{ row.stageName }}</td>
          <td>{{ cellValue(row, 'minimum') }}</td>
          <td>{{ cellValue(row, 'recommended') }}</td>
          <td>{{ cellValue(row, 'skills') }}</td>
          <td>{{ percent(row.total) }}</td>
          <td>{{ row.summary.minimum.none ? 'Yes' : 'No' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
