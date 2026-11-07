<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ApplicantDrawer from '@/components/ApplicantDrawer.vue'
import ApplicantFormDialog from '@/components/ApplicantFormDialog.vue'
import AppShell from '@/components/AppShell.vue'
import BoardColumn from '@/components/BoardColumn.vue'
import BoardFormDialog from '@/components/BoardFormDialog.vue'
import BoardSwitcher from '@/components/BoardSwitcher.vue'
import ColumnDialog from '@/components/ColumnDialog.vue'
import JobSpecDialog from '@/components/JobSpecDialog.vue'
import {
  candidatesInStep,
  closedCandidates,
  formatDeadline,
  initials,
  isOverdue,
  stepById,
  summariseBoard,
} from '@/lib/pipeline'
import { useBoardsStore } from '@/stores/boards'
import type { Candidate } from '@/types/pipeline'

const route = useRoute()
const router = useRouter()
const store = useBoardsStore()
const switcher = ref<InstanceType<typeof BoardSwitcher> | null>(null)
const dragged = ref<{ candidateId: string; stepId: string } | null>(null)
const settlingCandidateId = ref<string | null>(null)
const profileCandidateId = ref<string | null>(null)
const profileOpen = ref(false)
const editOpen = ref(false)
const columnsOpen = ref(false)
const jobSpecOpen = ref(false)
const applicantOpen = ref(false)
let settleTimer: ReturnType<typeof setTimeout> | undefined

const boardId = computed(() => String(route.params.boardId ?? ''))
const board = computed(() => store.boardById(boardId.value))
const summary = computed(() => (board.value ? summariseBoard(board.value) : undefined))
const hired = computed(() => (board.value ? closedCandidates(board.value, 'hired') : []))
const rejected = computed(() => (board.value ? closedCandidates(board.value, 'rejected') : []))

const draggedStepIndex = computed(() => {
  if (!board.value || !dragged.value) {
    return -1
  }

  return board.value.steps.findIndex((step) => step.id === dragged.value?.stepId)
})

const dropStepIds = computed(() => {
  if (!board.value || draggedStepIndex.value < 0) {
    return []
  }

  return [
    board.value.steps[draggedStepIndex.value - 1]?.id,
    board.value.steps[draggedStepIndex.value + 1]?.id,
  ].filter((id): id is string => Boolean(id))
})

function candidatesFor(stepId: string): Candidate[] {
  return board.value ? candidatesInStep(board.value, stepId) : []
}

function onBoardDeleted(): void {
  void router.push({ name: 'boards' })
}

function openProfile(candidate: Candidate): void {
  profileCandidateId.value = candidate.id
  profileOpen.value = true
}

function onCandidateDragStart(candidate: Candidate): void {
  settlingCandidateId.value = null
  window.clearTimeout(settleTimer)
  dragged.value = { candidateId: candidate.id, stepId: candidate.stepId }
}

function onCandidateDragEnd(): void {
  dragged.value = null
}

function onCandidateDrop(stepId: string): void {
  const current = dragged.value

  if (!current || !dropStepIds.value.includes(stepId)) {
    dragged.value = null
    return
  }

  store.moveCandidate(current.candidateId, stepId)
  settlingCandidateId.value = current.candidateId
  window.clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => {
    settlingCandidateId.value = null
  }, 220)
  dragged.value = null
}

function lastStepName(candidate: Candidate): string {
  if (!board.value) {
    return ''
  }

  return stepById(board.value, candidate.stepId)?.name ?? ''
}

function onKeydown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return
  }

  const tag = document.activeElement?.tagName ?? ''

  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return
  }

  if (event.key === '/') {
    event.preventDefault()
    switcher.value?.open()
  }
}

watch(boardId, () => {
  profileOpen.value = false
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  window.clearTimeout(settleTimer)
})
</script>

<template>
  <AppShell>
    <div v-if="!board" class="board-empty">
      <h2>Board not found.</h2>
      <p>This role may have been removed or the link is incorrect.</p>
      <v-btn color="primary" to="/boards">Back to boards</v-btn>
    </div>

    <div v-else class="board-detail-layout">
      <header class="page-heading board-heading">
        <div>
          <p class="eyebrow">{{ board.department }}</p>
          <h1 class="page-title board-title">{{ board.name }}</h1>
          <p class="lede">
            {{ board.openPositions }}
            {{ board.openPositions === 1 ? 'open position' : 'open positions' }}.
            {{ summary?.active ?? 0 }} active
            {{ summary?.active === 1 ? 'candidate' : 'candidates' }}. Deadline
            {{ formatDeadline(board.deadline) }}.
            <template v-if="isOverdue(board)"> Past deadline. </template>
          </p>
        </div>

        <div class="board-controls">
          <BoardSwitcher ref="switcher" :groups="store.groups" :active-board-id="board.id" />

          <div class="board-nav">
            <v-btn
              class="board-icon-btn"
              icon="mdi-pencil-outline"
              variant="outlined"
              aria-label="Edit board"
              title="Edit board"
              @click="editOpen = true"
            />
            <v-btn
              class="board-icon-btn"
              icon="mdi-view-column-outline"
              variant="outlined"
              aria-label="Manage columns"
              title="Manage columns"
              @click="columnsOpen = true"
            />
            <v-btn
              class="board-icon-btn"
              icon="mdi-file-document-outline"
              variant="outlined"
              aria-label="Job spec"
              title="Job spec"
              @click="jobSpecOpen = true"
            />
            <v-btn
              class="board-icon-btn"
              color="primary"
              icon="mdi-account-plus-outline"
              aria-label="Add applicant"
              title="Add applicant"
              @click="applicantOpen = true"
            />
          </div>
        </div>
      </header>

      <v-alert v-if="store.error" class="orbital-alert mb-6" type="error" density="compact">
        {{ store.error }}
      </v-alert>

      <div class="board-columns-wrap">
        <div class="board-columns" :style="{ '--columns': board.steps.length }">
          <BoardColumn
            v-for="(step, index) in board.steps"
            :key="step.id"
            :board="board"
            :step="step"
            :index="index"
            :candidates="candidatesFor(step.id)"
            :drop-target="dropStepIds.includes(step.id)"
            :dragging-candidate-id="dragged?.candidateId"
            :settling-candidate-id="settlingCandidateId ?? undefined"
            @drag-start="onCandidateDragStart"
            @drag-end="onCandidateDragEnd"
            @open-profile="openProfile"
            @drop="onCandidateDrop"
          />
        </div>
      </div>

      <details class="closed-panel">
        <summary>
          Closed candidates. {{ hired.length }} hired, {{ rejected.length }} rejected.
        </summary>

        <div class="closed-grid">
          <div class="closed-column">
            <h3>
              Hired <span>{{ hired.length }}</span>
            </h3>
            <p v-if="!hired.length" class="closed-empty">None yet.</p>
            <div v-for="candidate in hired" :key="candidate.id" class="closed-row">
              <span class="candidate-avatar candidate-avatar--small" aria-hidden="true">
                {{ initials(candidate.name) }}
              </span>
              <div class="closed-row__copy">
                <p class="candidate-name">{{ candidate.name }}</p>
                <p class="candidate-source">Last step: {{ lastStepName(candidate) }}</p>
              </div>
              <v-btn size="small" variant="text" @click="store.reopenCandidate(candidate.id)">
                Reopen
              </v-btn>
            </div>
          </div>

          <div class="closed-column">
            <h3>
              Rejected <span>{{ rejected.length }}</span>
            </h3>
            <p v-if="!rejected.length" class="closed-empty">None yet.</p>
            <div v-for="candidate in rejected" :key="candidate.id" class="closed-row">
              <span class="candidate-avatar candidate-avatar--small" aria-hidden="true">
                {{ initials(candidate.name) }}
              </span>
              <div class="closed-row__copy">
                <p class="candidate-name">{{ candidate.name }}</p>
                <p class="candidate-source">Last step: {{ lastStepName(candidate) }}</p>
              </div>
              <v-btn size="small" variant="text" @click="store.reopenCandidate(candidate.id)">
                Reopen
              </v-btn>
            </div>
          </div>
        </div>
      </details>
    </div>

    <BoardFormDialog v-model="editOpen" :board="board" @deleted="onBoardDeleted" />
    <ColumnDialog v-model="columnsOpen" :board="board" />
    <JobSpecDialog v-model="jobSpecOpen" :board="board" />
    <ApplicantFormDialog v-model="applicantOpen" :board="board" />
    <ApplicantDrawer v-model="profileOpen" :candidate-id="profileCandidateId" />
  </AppShell>
</template>
