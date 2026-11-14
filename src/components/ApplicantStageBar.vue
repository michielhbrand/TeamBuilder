<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { applicantActions } from '@/lib/pipeline'
import { useApplicantsStore } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import type { PipelineStep } from '@/types/pipeline'

const props = defineProps<{
  candidateId: string
}>()

const emit = defineEmits<{
  retry: []
}>()

const store = useApplicantsStore()
const boards = useBoardsStore()

const candidate = computed(() => store.candidateById(props.candidateId))
const board = computed(() =>
  candidate.value ? boards.boardById(candidate.value.boardId) : undefined,
)
const actions = computed(() =>
  board.value && candidate.value ? applicantActions(board.value, candidate.value) : undefined,
)
const closed = computed(() => candidate.value?.status !== 'active')
const currentIndex = computed(
  () => board.value?.steps.findIndex((step) => step.id === candidate.value?.stepId) ?? -1,
)
const saveStatus = computed(() => store.saveStatusFor(props.candidateId))
const saving = computed(() => saveStatus.value === 'pending' || saveStatus.value === 'saving')

const stepsList = ref<HTMLElement | null>(null)

function revealCurrentStage(): void {
  void nextTick(() => {
    const list = stepsList.value
    const current = list?.querySelector<HTMLElement>('[aria-current="step"]')

    if (list && current && list.scrollWidth > list.clientWidth) {
      list.scrollLeft +=
        current.getBoundingClientRect().left - list.getBoundingClientRect().left - 18
    }
  })
}

onMounted(revealCurrentStage)
watch(() => candidate.value?.stepId, revealCurrentStage)

function moveTo(step: PipelineStep): void {
  if (closed.value || step.id === candidate.value?.stepId) {
    return
  }

  void store.moveCandidate(props.candidateId, step.id)
}
</script>

<template>
  <section v-if="candidate && board" class="applicant-stage-bar" aria-label="Stage and decision">
    <ol ref="stepsList" class="applicant-stage-bar__steps" aria-label="Stage">
      <li v-for="(step, index) in board.steps" :key="step.id" class="applicant-stage-bar__item">
        <v-icon
          v-if="index > 0"
          class="applicant-stage-bar__chevron"
          icon="mdi-chevron-right"
          size="16"
          aria-hidden="true"
        />
        <button
          type="button"
          class="applicant-stage-bar__stage"
          :class="{
            'applicant-stage-bar__stage--done': index < currentIndex,
            'applicant-stage-bar__stage--current': index === currentIndex,
          }"
          :aria-current="index === currentIndex ? 'step' : undefined"
          :title="closed || index === currentIndex ? undefined : `Move to ${step.name}`"
          :disabled="closed"
          @click="moveTo(step)"
        >
          {{ step.name }}
        </button>
      </li>
    </ol>

    <div class="applicant-stage-bar__actions">
      <template v-if="!closed">
        <v-btn
          v-if="actions?.next"
          class="applicant-stage-bar__next"
          color="primary"
          variant="flat"
          prepend-icon="mdi-arrow-right"
          :height="44"
          @click="store.advanceCandidate(candidate.id)"
        >
          Move to {{ actions.next.name }}
        </v-btn>
        <v-btn
          class="applicant-stage-bar__hire"
          variant="outlined"
          prepend-icon="mdi-check-circle-outline"
          :height="44"
          @click="store.hireCandidate(candidate.id)"
        >
          Hire
        </v-btn>
        <v-btn
          class="applicant-stage-bar__reject"
          variant="outlined"
          prepend-icon="mdi-close-circle-outline"
          :height="44"
          @click="store.rejectCandidate(candidate.id)"
        >
          Reject
        </v-btn>
      </template>

      <template v-else>
        <span
          class="meta-chip applicant-stage-bar__outcome"
          :class="`applicant-stage-bar__outcome--${candidate.status}`"
        >
          <v-icon
            :icon="
              candidate.status === 'hired' ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'
            "
            size="16"
            aria-hidden="true"
          />{{ candidate.status === 'hired' ? 'Hired' : 'Rejected' }}
        </span>
        <v-btn
          variant="outlined"
          prepend-icon="mdi-restore"
          :height="44"
          @click="store.reopenCandidate(candidate.id)"
        >
          Reopen
        </v-btn>
      </template>

      <span
        class="applicant-save"
        :class="{ 'applicant-save--failed': saveStatus === 'failed' }"
        role="status"
        aria-live="polite"
      >
        <template v-if="saving">
          <v-icon icon="mdi-sync" size="16" aria-hidden="true" />
          Saving...
        </template>
        <template v-else-if="saveStatus === 'saved'">
          <v-icon class="applicant-save__ok" icon="mdi-check" size="16" aria-hidden="true" />
          Saved
        </template>
        <template v-else-if="saveStatus === 'failed'">
          <v-icon icon="mdi-alert-circle-outline" size="16" aria-hidden="true" />
          <span title="Your edits stay here until they can be saved.">Couldn't save</span>
          <span aria-hidden="true">·</span>
          <v-btn
            class="applicant-save__retry"
            variant="text"
            density="comfortable"
            :height="32"
            @click="emit('retry')"
          >
            Retry
          </v-btn>
        </template>
      </span>
    </div>
  </section>
</template>
