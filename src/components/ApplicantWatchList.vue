<script setup lang="ts">
import { initials } from '@/lib/pipeline'
import type { CandidateEntry } from '@/types/pipeline'

const props = defineProps<{
  entries: CandidateEntry[]
  mode: 'newest' | 'step'
  emptyLabel: string
}>()

const emit = defineEmits<{
  open: [candidateId: string]
}>()

function dayLabel(entry: CandidateEntry): string {
  const days = props.mode === 'newest' ? entry.daysSinceApplied : entry.daysInStep

  if (days === 0) {
    return props.mode === 'newest' ? 'Today' : 'Entered today'
  }

  return props.mode === 'newest' ? `${days}d ago` : `${days}d in step`
}

function metaLabel(entry: CandidateEntry): string {
  const step = entry.step?.name ?? 'No step'
  const status = entry.candidate.status === 'active' ? '' : ` \u00b7 ${entry.candidate.status}`

  return `${entry.board.name} \u00b7 ${step}${status}`
}
</script>

<template>
  <div class="watch-list">
    <p v-if="!entries.length" class="overview-empty">{{ emptyLabel }}</p>

    <button
      v-for="entry in entries"
      :key="entry.candidate.id"
      class="watch-row"
      type="button"
      :aria-label="`Open applicant profile for ${entry.candidate.name}`"
      @click="emit('open', entry.candidate.id)"
    >
      <span class="candidate-avatar candidate-avatar--small" aria-hidden="true">
        {{ initials(entry.candidate.name) }}
      </span>

      <span class="watch-row__copy">
        <span class="watch-row__name">
          {{ entry.candidate.name }}
          <v-icon
            v-if="entry.candidate.favorite"
            class="watch-row__star"
            icon="mdi-star"
            size="14"
            aria-label="Favourite"
          />
        </span>
        <span class="watch-row__meta">{{ metaLabel(entry) }}</span>
      </span>

      <span class="watch-row__days">{{ dayLabel(entry) }}</span>
    </button>
  </div>
</template>
