<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ApplicantDrawer from '@/components/ApplicantDrawer.vue'
import ApplicantFormDialog from '@/components/ApplicantFormDialog.vue'
import AppShell from '@/components/AppShell.vue'
import BoardColumn from '@/components/BoardColumn.vue'
import BoardFormDialog from '@/components/BoardFormDialog.vue'
import BoardSwitcher from '@/components/BoardSwitcher.vue'
import ColumnDialog from '@/components/ColumnDialog.vue'
import JobSpecDialog from '@/components/JobSpecDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import StageTabs from '@/components/StageTabs.vue'
import {
  candidatesInStep,
  closedCandidates,
  deadlineLabel,
  formatDeadline,
  initials,
  stepById,
  summariseBoard,
} from '@/lib/pipeline'
import { useMediaQuery } from '@/lib/use-media-query'
import { useApplicantsStore } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import { useFitStore } from '@/stores/fit'
import type { FitRankEntry } from '@/lib/fit-rank'
import type { Board, Candidate } from '@/types/pipeline'

const route = useRoute()
const router = useRouter()
const store = useBoardsStore()
const applicants = useApplicantsStore()
const fit = useFitStore()
const switcher = ref<InstanceType<typeof BoardSwitcher> | null>(null)
const dragged = ref<{ candidateId: string; stepId: string } | null>(null)
const settlingCandidateId = ref<string | null>(null)
const profileCandidateId = ref<string | null>(null)
const autoFitCandidateId = ref<string | null>(null)
const profileOpen = ref(false)
const editOpen = ref(false)
const columnsOpen = ref(false)
const jobSpecOpen = ref(false)
const applicantOpen = ref(false)
const closedOpen = ref(false)
const rankByFit = ref(false)
const selectedStepId = ref<string | null>(null)
const isPhone = useMediaQuery('(max-width: 720px)')
const isCompact = useMediaQuery('(max-width: 1024px), (hover: none)')
const secondaryHeight = computed(() => (isCompact.value ? 40 : 36))
let settleTimer: ReturnType<typeof setTimeout> | undefined

const boardId = computed(() => String(route.params.boardId ?? ''))
const board = computed(() => store.boardById(boardId.value))
const summary = computed(() => (board.value ? summariseBoard(board.value) : undefined))
const hired = computed(() => (board.value ? closedCandidates(board.value, 'hired') : []))
const rejected = computed(() => (board.value ? closedCandidates(board.value, 'rejected') : []))
const deadline = computed(() => (board.value ? deadlineLabel(board.value) : undefined))
const stageCounts = computed(() =>
  board.value ? board.value.steps.map((step) => candidatesFor(step.id).length) : [],
)
const visibleSteps = computed(() => {
  if (!board.value) {
    return []
  }

  if (!isPhone.value) {
    return board.value.steps
  }

  return board.value.steps.filter((step) => step.id === selectedStepId.value)
})

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
  const candidates = board.value ? candidatesInStep(board.value, stepId) : []

  if (!rankByFit.value || !board.value) {
    return candidates
  }

  const ranks = fit.rankForStage(board.value.id, stepId)

  return [...candidates].sort((left, right) => {
    const leftRank = ranks.get(left.id)
    const rightRank = ranks.get(right.id)

    if (leftRank && rightRank) {
      return leftRank.rank - rightRank.rank
    }

    if (leftRank) {
      return -1
    }

    if (rightRank) {
      return 1
    }

    return 0
  })
}

function fitRanksFor(stepId: string): Map<string, FitRankEntry> {
  return board.value ? fit.rankForStage(board.value.id, stepId) : new Map()
}

function defaultStepId(target: Board): string | null {
  const withApplicants = target.steps.find((step) => candidatesInStep(target, step.id).length > 0)

  return (withApplicants ?? target.steps[0])?.id ?? null
}

function onBoardDeleted(): void {
  void router.push({ name: 'boards' })
}

function openProfile(candidate: Candidate): void {
  autoFitCandidateId.value = null
  profileCandidateId.value = candidate.id
  profileOpen.value = true
}

function openCreatedApplicant(candidate: Candidate): void {
  autoFitCandidateId.value = candidate.cvPath ? candidate.id : null
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

  void applicants.moveCandidate(current.candidateId, stepId)
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
    if (
      profileOpen.value ||
      editOpen.value ||
      columnsOpen.value ||
      jobSpecOpen.value ||
      applicantOpen.value
    ) {
      return
    }

    event.preventDefault()
    switcher.value?.open()
  }
}

watch(boardId, () => {
  profileOpen.value = false
  closedOpen.value = false
  selectedStepId.value = null
})

watch(
  boardId,
  (id) => {
    if (id) {
      void fit.loadBoard(id)
    }
  },
  { immediate: true },
)

watch(
  () => [boardId.value, board.value?.steps.map((step) => step.id).join(',')],
  () => {
    const current = board.value

    if (!current) {
      return
    }

    if (!current.steps.some((step) => step.id === selectedStepId.value)) {
      selectedStepId.value = defaultStepId(current)
    }
  },
  { immediate: true },
)

watch(profileOpen, (open) => {
  if (!open) {
    autoFitCandidateId.value = null
  }
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
      <PageHeader class="board-header" :title="board.name">
        <template #breadcrumb>
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <RouterLink to="/boards">Boards</RouterLink>
            <v-icon icon="mdi-chevron-right" size="16" aria-hidden="true" />
            <span>{{ board.department }}</span>
          </nav>
        </template>

        <template #title-adornment>
          <BoardSwitcher ref="switcher" :groups="store.groups" :active-board-id="board.id" />
        </template>

        <template #meta>
          <span class="meta-chip">
            <v-icon icon="mdi-account-multiple-outline" size="16" aria-hidden="true" />
            {{ board.openPositions }}
            {{ board.openPositions === 1 ? 'open position' : 'open positions' }}
          </span>
          <span class="meta-chip">
            <v-icon icon="mdi-account-group-outline" size="16" aria-hidden="true" />
            {{ summary?.active ?? 0 }} active
            {{ summary?.active === 1 ? 'applicant' : 'applicants' }}
          </span>
          <span
            v-if="deadline"
            class="meta-chip"
            :class="{ 'meta-chip--danger': deadline.overdue }"
            :title="`Deadline ${formatDeadline(board.deadline)}`"
          >
            <v-icon
              :icon="deadline.overdue ? 'mdi-alert-circle-outline' : 'mdi-calendar-clock-outline'"
              size="16"
              aria-hidden="true"
            />
            {{ deadline.text }}
          </span>
          <v-btn
            class="board-jobspec-btn"
            prepend-icon="mdi-file-document-outline"
            variant="text"
            :height="secondaryHeight"
            @click="jobSpecOpen = true"
          >
            Job spec
          </v-btn>
        </template>

        <template #actions>
          <v-btn
            :color="rankByFit ? 'primary' : undefined"
            :variant="rankByFit ? 'flat' : 'outlined'"
            prepend-icon="mdi-sort-numeric-ascending"
            :aria-pressed="rankByFit"
            @click="rankByFit = !rankByFit"
          >
            Rank by CV fit
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-account-plus-outline"
            @click="applicantOpen = true"
          >
            Add applicant
          </v-btn>
          <v-menu location="bottom end" :offset="4">
            <template #activator="{ props: menuProps }">
              <v-btn v-bind="menuProps" prepend-icon="mdi-dots-horizontal" variant="outlined">
                Board
              </v-btn>
            </template>
            <v-list class="app-menu board-menu" density="compact">
              <v-list-item
                prepend-icon="mdi-pencil-outline"
                title="Edit board"
                @click="editOpen = true"
              />
              <v-list-item
                prepend-icon="mdi-view-column-outline"
                title="Manage stages"
                @click="columnsOpen = true"
              />
            </v-list>
          </v-menu>
        </template>
      </PageHeader>

      <v-alert
        v-if="store.error || applicants.error"
        class="orbital-alert mb-6"
        type="error"
        density="compact"
      >
        {{ store.error || applicants.error }}
      </v-alert>

      <v-alert
        v-if="fit.boardErrorFor(board.id)"
        class="orbital-alert mb-6"
        type="warning"
        density="compact"
      >
        {{ fit.boardErrorFor(board.id) }}
      </v-alert>

      <StageTabs
        v-if="isPhone && selectedStepId"
        v-model="selectedStepId"
        class="board-stage-tabs"
        :steps="board.steps"
        :counts="stageCounts"
        panel-id="board-stage-panel"
      />

      <div
        :id="isPhone ? 'board-stage-panel' : undefined"
        class="board-columns-wrap"
        :role="isPhone ? 'tabpanel' : undefined"
        :aria-labelledby="isPhone && selectedStepId ? `stage-tab-${selectedStepId}` : undefined"
      >
        <div class="board-columns" :style="{ '--columns': visibleSteps.length }">
          <BoardColumn
            v-for="step in visibleSteps"
            :key="step.id"
            :board="board"
            :step="step"
            :candidates="candidatesFor(step.id)"
            :fit-ranks="fitRanksFor(step.id)"
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

      <section class="closed-panel" aria-label="Closed applicants">
        <div class="closed-summary">
          <v-icon class="closed-summary__icon" icon="mdi-archive-outline" aria-hidden="true" />
          <p>
            <strong>Closed</strong> &middot; {{ hired.length }} hired, {{ rejected.length }}
            rejected
          </p>
          <v-btn
            class="closed-summary__toggle"
            :append-icon="closedOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            variant="text"
            :height="secondaryHeight"
            :aria-expanded="closedOpen"
            aria-controls="closed-lists"
            @click="closedOpen = !closedOpen"
          >
            {{ closedOpen ? 'Hide' : 'Show' }}
          </v-btn>
        </div>

        <div v-show="closedOpen" id="closed-lists" class="closed-grid">
          <div class="closed-column">
            <h3>
              Hired <span>{{ hired.length }}</span>
            </h3>
            <p v-if="!hired.length" class="closed-empty">None yet.</p>
            <div v-for="candidate in hired" :key="candidate.id" class="closed-row">
              <button
                class="closed-row__open"
                type="button"
                :aria-label="`Open profile for ${candidate.name}`"
                @click="openProfile(candidate)"
              >
                <span class="candidate-avatar candidate-avatar--small" aria-hidden="true">
                  {{ initials(candidate.name) }}
                </span>
                <span class="closed-row__copy">
                  <span class="candidate-name">{{ candidate.name }}</span>
                  <span class="candidate-source">Last stage: {{ lastStepName(candidate) }}</span>
                </span>
              </button>
              <v-btn
                variant="outlined"
                :height="secondaryHeight"
                @click="applicants.reopenCandidate(candidate.id)"
              >
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
              <button
                class="closed-row__open"
                type="button"
                :aria-label="`Open profile for ${candidate.name}`"
                @click="openProfile(candidate)"
              >
                <span class="candidate-avatar candidate-avatar--small" aria-hidden="true">
                  {{ initials(candidate.name) }}
                </span>
                <span class="closed-row__copy">
                  <span class="candidate-name">{{ candidate.name }}</span>
                  <span class="candidate-source">Last stage: {{ lastStepName(candidate) }}</span>
                </span>
              </button>
              <v-btn
                variant="outlined"
                :height="secondaryHeight"
                @click="applicants.reopenCandidate(candidate.id)"
              >
                Reopen
              </v-btn>
            </div>
          </div>
        </div>
      </section>
    </div>

    <BoardFormDialog v-model="editOpen" :board="board" @deleted="onBoardDeleted" />
    <ColumnDialog v-model="columnsOpen" :board="board" />
    <JobSpecDialog v-model="jobSpecOpen" :board="board" />
    <ApplicantFormDialog v-model="applicantOpen" :board="board" @created="openCreatedApplicant" />
    <ApplicantDrawer
      v-model="profileOpen"
      :candidate-id="profileCandidateId"
      :auto-fit-candidate-id="autoFitCandidateId"
    />
  </AppShell>
</template>
