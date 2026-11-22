<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useApplicantsStore } from '@/stores/applicants'
import {
  applicantActions,
  daysInStep as getDaysInStep,
  initials as getInitials,
} from '@/lib/pipeline'
import type { FitRankEntry } from '@/lib/fit-rank'
import type { Board, Candidate, PipelineStep } from '@/types/pipeline'

const props = defineProps<{
  board: Board
  candidate: Candidate
  fitRank?: FitRankEntry
  dragging?: boolean
  settling?: boolean
}>()

const emit = defineEmits<{
  'drag-start': [candidate: Candidate]
  'drag-end': []
  'open-profile': [candidate: Candidate]
}>()

const store = useApplicantsStore()
const menuOpen = ref(false)
const choosingStage = ref(false)
const menuList = ref<{ $el: HTMLElement } | null>(null)

const actions = computed(() => applicantActions(props.board, props.candidate))
const next = computed(() => actions.value.next)
const previous = computed(() => actions.value.previous)
const canDrag = computed(() => Boolean(next.value || previous.value))
const otherSteps = computed(() =>
  props.board.steps.filter((step) => step.id !== props.candidate.stepId),
)

const initials = computed(() => getInitials(props.candidate.name))

const daysLabel = computed(() => {
  const days = getDaysInStep(props.candidate)

  if (days === 0) {
    return 'Entered this stage today'
  }

  return `${days} ${days === 1 ? 'day' : 'days'} in stage`
})

const fitLabel = computed(() => {
  const rank = props.fitRank

  if (!rank) {
    return ''
  }

  const parts = [`Rank ${rank.rank}`]

  if (rank.summary.minimum.total) {
    parts.push(`minimum ${rank.summary.minimum.full} of ${rank.summary.minimum.total} fully met`)
  }

  if (rank.summary.recommended.total) {
    parts.push(
      `recommended ${rank.summary.recommended.full} of ${rank.summary.recommended.total} fully met`,
    )
  }

  if (rank.summary.minimum.none) {
    parts.push(`${rank.summary.minimum.none} minimum not met`)
  }

  return parts.join(', ')
})

watch(menuOpen, (open) => {
  if (!open) {
    choosingStage.value = false
  }
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

function showStages(value: boolean): void {
  choosingStage.value = value
  void nextTick(() => menuList.value?.$el.querySelector<HTMLElement>('.v-list-item')?.focus())
}

function fromMenu(action: () => unknown): void {
  menuOpen.value = false
  void action()
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
    class="candidate-card"
    :class="{
      'candidate-card--draggable': canDrag,
      'candidate-card--dragging': dragging,
      'candidate-card--settling': settling,
      'candidate-card--menu-open': menuOpen,
    }"
    :draggable="canDrag"
    @click="openProfile"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="candidate-card__top">
      <span class="candidate-avatar" aria-hidden="true">{{ initials }}</span>
      <button
        class="candidate-card__open"
        type="button"
        :aria-label="`Open profile for ${candidate.name}`"
        @click.stop="openProfile"
      >
        <span class="candidate-name">{{ candidate.name }}</span>
        <span v-if="candidate.currentRole" class="candidate-source">
          {{ candidate.currentRole }}
        </span>
      </button>
      <v-btn
        class="candidate-favorite"
        :class="{ 'candidate-favorite--on': candidate.favorite }"
        :icon="candidate.favorite ? 'mdi-star' : 'mdi-star-outline'"
        :color="candidate.favorite ? 'primary' : undefined"
        variant="text"
        :aria-label="
          candidate.favorite
            ? `Remove ${candidate.name} from favorites`
            : `Add ${candidate.name} to favorites`
        "
        :aria-pressed="candidate.favorite"
        @click.stop="store.toggleFavorite(candidate.id)"
      />
    </div>

    <p v-if="fitRank" class="candidate-fit" :aria-label="fitLabel">
      <span class="candidate-fit__rank">#{{ fitRank.rank }}</span>
      <span v-if="fitRank.summary.minimum.total" class="candidate-fit__item">
        Min {{ fitRank.summary.minimum.full }}/{{ fitRank.summary.minimum.total }}
      </span>
      <span v-if="fitRank.summary.recommended.total" class="candidate-fit__item">
        Rec {{ fitRank.summary.recommended.full }}/{{ fitRank.summary.recommended.total }}
      </span>
      <v-icon
        v-if="fitRank.summary.minimum.none"
        class="candidate-fit__warning"
        icon="mdi-alert-circle-outline"
        size="15"
        aria-hidden="true"
      />
    </p>

    <div class="candidate-card__foot">
      <p class="candidate-days">
        <v-icon icon="mdi-clock-outline" size="16" aria-hidden="true" />
        <span>{{ daysLabel }}</span>
      </p>

      <div class="candidate-tools" @click.stop>
        <v-btn
          v-if="previous"
          class="candidate-tool"
          icon="mdi-chevron-left"
          variant="text"
          :aria-label="`Move ${candidate.name} back to ${previous.name}`"
          @click="moveTo(previous)"
        />
        <v-btn
          v-if="next"
          class="candidate-tool"
          icon="mdi-chevron-right"
          variant="text"
          :aria-label="`Move ${candidate.name} forward to ${next.name}`"
          @click="moveTo(next)"
        />
        <v-menu
          v-model="menuOpen"
          :close-on-content-click="false"
          location="bottom end"
          :offset="4"
        >
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              class="candidate-tool"
              icon="mdi-dots-horizontal"
              variant="text"
              :aria-label="`More actions for ${candidate.name}`"
            />
          </template>

          <v-list
            v-if="!choosingStage"
            ref="menuList"
            class="app-menu candidate-menu"
            density="compact"
          >
            <v-list-item
              prepend-icon="mdi-open-in-new"
              title="Open profile"
              @click="fromMenu(openProfile)"
            />
            <v-list-item
              v-if="otherSteps.length"
              prepend-icon="mdi-arrow-right"
              append-icon="mdi-chevron-right"
              title="Move to..."
              @click="showStages(true)"
            />
            <v-divider class="my-1" />
            <v-list-item
              class="candidate-menu__hire"
              prepend-icon="mdi-check-circle-outline"
              title="Hire"
              @click="fromMenu(() => store.hireCandidate(candidate.id))"
            />
            <v-list-item
              class="candidate-menu__reject"
              prepend-icon="mdi-close-circle-outline"
              title="Reject"
              @click="fromMenu(() => store.rejectCandidate(candidate.id))"
            />
          </v-list>

          <v-list v-else ref="menuList" class="app-menu candidate-menu" density="compact">
            <v-list-item prepend-icon="mdi-chevron-left" title="Back" @click="showStages(false)" />
            <v-divider class="my-1" />
            <v-list-subheader>Move to stage</v-list-subheader>
            <v-list-item
              v-for="step in otherSteps"
              :key="step.id"
              :title="step.name"
              @click="fromMenu(() => moveTo(step))"
            />
          </v-list>
        </v-menu>
      </div>
    </div>
  </article>
</template>
