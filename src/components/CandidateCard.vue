<script setup lang="ts">
import { computed } from 'vue'
import { useBoardsStore } from '@/stores/boards'
import {
  daysInStep as getDaysInStep,
  daysSinceApplied as getDaysSinceApplied,
  initials as getInitials,
  nextStep,
  previousStep,
  stepById,
} from '@/lib/pipeline'
import type { Board, Candidate, PipelineStep } from '@/types/pipeline'

const props = defineProps<{
  board: Board
  candidate: Candidate
  dragging?: boolean
  settling?: boolean
}>()

const emit = defineEmits<{
  'drag-start': [candidate: Candidate]
  'drag-end': []
  'open-profile': [candidate: Candidate]
}>()

const store = useBoardsStore()

const step = computed(() => stepById(props.board, props.candidate.stepId))
const next = computed(() => nextStep(props.board, props.candidate))
const previous = computed(() => previousStep(props.board, props.candidate))
const canDrag = computed(() => Boolean(next.value || previous.value))

const initials = computed(() => getInitials(props.candidate.name))

const daysLabel = computed(() => {
  const days = getDaysInStep(props.candidate)

  if (days === 0) {
    return 'Entered this step today'
  }

  return `${days} ${days === 1 ? 'day' : 'days'} in step`
})

const appliedLabel = computed(() => {
  const days = getDaysSinceApplied(props.candidate)

  if (days === 0) {
    return 'applied today'
  }

  return `applied ${days} ${days === 1 ? 'day' : 'days'} ago`
})

function moveTo(target: PipelineStep | undefined): void {
  if (target) {
    void store.moveCandidate(props.candidate.id, target.id)
  }
}

function openProfile(): void {
  if (!props.dragging) {
    emit('open-profile', props.candidate)
  }
}

function createDragImage(source: HTMLElement): HTMLElement {
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.classList.add('candidate-card--drag-ghost')
  ghost.style.position = 'fixed'
  ghost.style.top = '-1000px'
  ghost.style.left = '-1000px'
  ghost.style.width = `${source.offsetWidth}px`
  ghost.style.pointerEvents = 'none'
  document.body.appendChild(ghost)
  return ghost
}

function onDragStart(event: DragEvent): void {
  if (!canDrag.value || !event.dataTransfer) {
    event.preventDefault()
    return
  }

  const source = event.currentTarget as HTMLElement | null

  if (source) {
    const rect = source.getBoundingClientRect()
    const ghost = createDragImage(source)
    event.dataTransfer.setDragImage(ghost, event.clientX - rect.left, event.clientY - rect.top)
    window.setTimeout(() => ghost.remove(), 0)
  }

  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', props.candidate.id)
  emit('drag-start', props.candidate)
}

function onDragEnd(): void {
  emit('drag-end')
}
</script>

<template>
  <article
    class="candidate-card candidate-card--clickable"
    :class="{
      'candidate-card--draggable': canDrag,
      'candidate-card--dragging': dragging,
      'candidate-card--settling': settling,
    }"
    :draggable="canDrag"
    role="button"
    tabindex="0"
    :aria-label="`Open applicant profile for ${candidate.name}`"
    @click="openProfile"
    @keydown.enter.self="openProfile"
    @keydown.space.self.prevent="openProfile"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <v-btn
      class="candidate-favorite"
      :icon="candidate.favorite ? 'mdi-star' : 'mdi-star-outline'"
      :color="candidate.favorite ? 'primary' : undefined"
      size="small"
      variant="text"
      :aria-label="candidate.favorite ? 'Remove from favourites' : 'Add to favourites'"
      :aria-pressed="candidate.favorite"
      @click.stop="store.toggleFavorite(candidate.id)"
    />

    <div class="candidate-card__main">
      <div class="candidate-card__top">
        <span class="candidate-avatar" aria-hidden="true">{{ initials }}</span>
        <div class="candidate-card__identity">
          <p class="candidate-name">{{ candidate.name }}</p>
          <p class="candidate-source">{{ candidate.currentRole || candidate.email }}</p>
        </div>
      </div>

      <p class="candidate-days">{{ daysLabel }}. {{ appliedLabel }}.</p>

      <div class="candidate-actions-row" @click.stop>
        <v-btn
          v-if="previous"
          class="candidate-lane-btn"
          icon="mdi-chevron-left"
          size="small"
          variant="text"
          :aria-label="`Move ${candidate.name} to ${previous.name}`"
          @click="moveTo(previous)"
        />

        <div class="candidate-actions">
          <v-btn
            class="candidate-action candidate-action--hire"
            color="primary"
            variant="outlined"
            @click="store.hireCandidate(candidate.id)"
          >
            Hire
          </v-btn>
          <v-btn
            class="candidate-action candidate-action--reject"
            color="error"
            variant="outlined"
            @click="store.rejectCandidate(candidate.id)"
          >
            Reject
          </v-btn>
        </div>

        <v-btn
          v-if="next"
          class="candidate-lane-btn"
          icon="mdi-chevron-right"
          size="small"
          variant="text"
          :aria-label="`Move ${candidate.name} to ${next.name}`"
          @click="moveTo(next)"
        />
      </div>

      <p v-if="step" class="candidate-step">Current step: {{ step.name }}</p>
    </div>
  </article>
</template>
