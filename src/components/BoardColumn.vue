<script setup lang="ts">
import CandidateCard from '@/components/CandidateCard.vue'
import type { FitRankEntry } from '@/lib/fit-rank'
import type { Board, Candidate, PipelineStep } from '@/types/pipeline'

const props = defineProps<{
  board: Board
  step: PipelineStep
  candidates: Candidate[]
  fitRanks?: Map<string, FitRankEntry>
  dropTarget?: boolean
  draggingCandidateId?: string
  settlingCandidateId?: string
}>()

const emit = defineEmits<{
  'drag-start': [candidate: Candidate]
  'drag-end': []
  'open-profile': [candidate: Candidate]
  drop: [stepId: string]
}>()

function onDragOver(event: DragEvent): void {
  if (!props.dropTarget) {
    return
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent): void {
  if (!props.dropTarget) {
    return
  }

  event.preventDefault()
  emit('drop', props.step.id)
}
</script>

<template>
  <section
    class="board-column"
    :class="{ 'board-column--drop-target': dropTarget }"
    :aria-label="step.name"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <header class="board-column__head">
      <h3>{{ step.name }}</h3>
      <span class="board-column__count">
        {{ candidates.length }}
        <span class="d-sr-only">{{ candidates.length === 1 ? 'applicant' : 'applicants' }}</span>
      </span>
    </header>

    <div class="board-column__body">
      <CandidateCard
        v-for="candidate in candidates"
        :key="candidate.id"
        :board="board"
        :candidate="candidate"
        :fit-rank="fitRanks?.get(candidate.id)"
        :dragging="candidate.id === draggingCandidateId"
        :settling="candidate.id === settlingCandidateId"
        @drag-start="emit('drag-start', $event)"
        @drag-end="emit('drag-end')"
        @open-profile="emit('open-profile', $event)"
      />
      <p v-if="!candidates.length" class="board-column__empty">No one in this stage.</p>
    </div>
  </section>
</template>
