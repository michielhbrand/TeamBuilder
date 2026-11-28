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
  const mode = props.mode === 'custom' ? 'Custom weights comparison' : 'Default comparison'
  const values = props.rows
    .map((row, index) => {
      if (props.mode === 'custom') {
        return `${row.name} ${row.total === null ? 'not comparable' : `${Math.round(row.total)}%`}`
      }

      return `${index + 1}. ${row.name}`
    })
    .join(', ')

  return `${mode} for ${props.rows.length} applicants: ${values}`
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

function openLabel(row: FitComparisonRow, index: number): string {
  const order =
    props.mode === 'custom'
      ? row.total === null
        ? 'not comparable'
        : `custom weights fit ${Math.round(row.total)}%`
      : `default order position ${index + 1}`

  return `Open ${row.name}, ${row.stageName}, ${order}`
}

function displayValue(row: FitComparisonRow, index: number): string {
  return props.mode === 'custom' ? percent(row.total) : `#${index + 1}`
}

function fitCell(row: FitComparisonRow, index: number): string {
  return props.mode === 'custom' ? percent(row.total) : `#${index + 1}`
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
          <li v-for="(row, index) in rows" :key="row.applicantId" class="fit-compare-cluster">
            <button
              type="button"
              class="fit-compare-cluster__button"
              :aria-label="openLabel(row, index)"
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

              <span class="fit-compare-cluster__value">{{ displayValue(row, index) }}</span>
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
        Candidate comparison,
        {{
          mode === 'custom' ? 'custom weights' : 'default order'
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Applicant</th>
          <th scope="col">Stage</th>
          <th scope="col">Minimum</th>
          <th scope="col">Recommended</th>
          <th scope="col">Skills</th>
          <th scope="col">{{ mode === 'custom' ? 'Custom weights fit' : 'Default order' }}</th>
          <th scope="col">Minimum missed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.applicantId">
          <th scope="row">{{ row.name }}</th>
          <td>{{ row.stageName }}</td>
          <td>{{ cellValue(row, 'minimum') }}</td>
          <td>{{ cellValue(row, 'recommended') }}</td>
          <td>{{ cellValue(row, 'skills') }}</td>
          <td>{{ fitCell(row, index) }}</td>
          <td>{{ row.summary.minimum.none ? 'Yes' : 'No' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
