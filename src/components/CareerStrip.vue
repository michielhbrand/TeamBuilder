<script setup lang="ts">
import { computed } from 'vue'
import {
  employmentGaps,
  entryDuration,
  formatMonth,
  formatPeriod,
  layoutStrip,
  type CareerLane,
} from '@/lib/career'
import type { CareerEntry, CareerKind } from '@/types/pipeline'

const props = withDefaults(
  defineProps<{
    experience: CareerEntry[]
    education: CareerEntry[]
    lanes?: CareerLane[]
    highlightId?: string | null
  }>(),
  { lanes: () => ['experience', 'education'], highlightId: null },
)

const emit = defineEmits<{
  select: [kind: CareerKind, id: string]
  hover: [id: string | null]
}>()

const layout = computed(() => layoutStrip(props.experience, props.education, props.lanes))
const laneLabels: Record<CareerLane, string> = { experience: 'Work', education: 'Education' }

const readout = computed(() => {
  const entry = [...props.experience, ...props.education].find(
    (item) => item.id === props.highlightId,
  )

  if (entry) {
    return [
      entry.title || 'Untitled',
      entry.organization,
      formatPeriod(entry),
      entryDuration(entry),
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const gaps = props.lanes.includes('experience') ? employmentGaps(props.experience) : []

  if (!gaps.length) {
    return 'Hover a bar for details'
  }

  return `${gaps.length === 1 ? '1 gap' : `${gaps.length} gaps`}: ${gaps
    .map((gap) => `${formatMonth(gap.from)} → ${formatMonth(gap.to)} (${gap.months} mo)`)
    .join(', ')}`
})

function barLabel(entry: CareerEntry, lane: CareerLane): string {
  const kind = lane === 'experience' ? 'Work' : 'Education'
  return `${kind}: ${entry.title || 'Untitled'}, ${formatPeriod(entry)}`
}
</script>

<template>
  <div class="career-strip">
    <div v-if="lanes.length > 1" class="career-strip__head">
      <span class="career-strip__title">Career at a glance</span>
      <span class="career-strip__legend">
        <i class="career-strip__swatch" />
        Work
      </span>
      <span class="career-strip__legend">
        <i class="career-strip__swatch career-strip__swatch--education" />
        Education
      </span>
    </div>

    <p v-if="!layout" class="career-strip__empty">
      Add start and end months to see the career strip.
    </p>

    <template v-else>
      <div class="career-strip__plot">
        <div
          v-for="tick in layout.ticks"
          :key="tick.year"
          class="career-strip__tick"
          :style="{ left: `${tick.left}%` }"
        >
          <span>{{ tick.year }}</span>
        </div>

        <div v-for="lane in layout.lanes" :key="lane.lane" class="career-strip__lane">
          <span v-if="lanes.length > 1" class="career-strip__lane-label">
            {{ laneLabels[lane.lane] }}
          </span>

          <div v-for="(row, rowIndex) in lane.rows" :key="rowIndex" class="career-strip__row">
            <template v-if="rowIndex === 0 && lane.lane === 'experience'">
              <span
                v-for="gap in layout.gaps"
                :key="gap.from"
                class="career-strip__gap"
                :style="{ left: `${gap.left}%`, width: `${gap.width}%` }"
                :title="`${gap.months} month gap`"
              />
            </template>

            <button
              v-for="bar in row"
              :key="bar.entry.id"
              type="button"
              class="career-bar"
              :class="[
                `career-bar--${bar.lane}`,
                {
                  'career-bar--now': bar.entry.current,
                  'career-bar--active': highlightId === bar.entry.id,
                },
              ]"
              :style="{ left: `${bar.left}%`, width: `${bar.width}%` }"
              :title="barLabel(bar.entry, bar.lane)"
              :aria-label="barLabel(bar.entry, bar.lane)"
              @mouseenter="emit('hover', bar.entry.id)"
              @mouseleave="emit('hover', null)"
              @focus="emit('hover', bar.entry.id)"
              @blur="emit('hover', null)"
              @click="
                emit('select', bar.lane === 'experience' ? 'experience' : 'education', bar.entry.id)
              "
            >
              {{ bar.entry.title || 'Untitled' }}
            </button>
          </div>
        </div>
      </div>

      <p class="career-strip__readout" aria-live="polite">{{ readout }}</p>
    </template>
  </div>
</template>
