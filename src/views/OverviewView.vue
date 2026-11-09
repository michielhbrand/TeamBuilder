<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import ApplicantDrawer from '@/components/ApplicantDrawer.vue'
import ApplicantWatchList from '@/components/ApplicantWatchList.vue'
import DepartmentLoadChart from '@/components/DepartmentLoadChart.vue'
import OutcomeDonut from '@/components/OutcomeDonut.vue'
import RolePerformanceTable from '@/components/RolePerformanceTable.vue'
import {
  candidateEntries,
  daysUntilDeadline,
  departmentTotals,
  formatDeadline,
  longestInStepEntries,
  newestCandidateEntries,
  summariseBoard,
  summariseBoards,
} from '@/lib/pipeline'
import { useBoardsStore } from '@/stores/boards'
import type { BoardSummary } from '@/types/pipeline'

const store = useBoardsStore()
const selectedDepartment = ref('all')
const profileCandidateId = ref<string | null>(null)
const profileOpen = ref(false)

const departmentRows = computed(() =>
  store.groups.map((group) => ({
    department: group.department,
    ...departmentTotals(group),
  })),
)

const filteredBoards = computed(() =>
  selectedDepartment.value === 'all'
    ? store.orderedBoards
    : store.boards.filter((board) => board.department === selectedDepartment.value),
)

const summaries = computed(() => filteredBoards.value.map(summariseBoard))
const totals = computed(() => summariseBoards(filteredBoards.value))
const closedCount = computed(() => totals.value.hired + totals.value.rejected)
const totalCandidates = computed(() => totals.value.active + closedCount.value)
const overdueCount = computed(() => summaries.value.filter((summary) => summary.overdue).length)
const dueSoonCount = computed(
  () =>
    filteredBoards.value.filter((board) => {
      const days = daysUntilDeadline(board.deadline)
      return days >= 0 && days <= 14
    }).length,
)

const conversion = computed(() => {
  if (!closedCount.value) {
    return null
  }

  return Math.round((totals.value.hired / closedCount.value) * 100)
})

const deadlineRows = computed(() =>
  [...summaries.value].sort((a, b) => a.board.deadline.localeCompare(b.board.deadline)).slice(0, 6),
)

const newestEntries = computed(() =>
  newestCandidateEntries(candidateEntries(filteredBoards.value), 5),
)
const longestEntries = computed(() =>
  longestInStepEntries(candidateEntries(filteredBoards.value, 'active'), 5),
)

watch(
  () => store.groups.map((group) => group.department),
  (departments) => {
    if (selectedDepartment.value !== 'all' && !departments.includes(selectedDepartment.value)) {
      selectedDepartment.value = 'all'
    }
  },
)

function selectDepartment(department: string): void {
  selectedDepartment.value = selectedDepartment.value === department ? 'all' : department
}

function deadlineLabel(summary: BoardSummary): string {
  const days = daysUntilDeadline(summary.board.deadline)

  if (days < 0) {
    return 'Past deadline'
  }

  if (days === 0) {
    return 'Due today'
  }

  if (days === 1) {
    return 'Due tomorrow'
  }

  return `Due in ${days} days`
}

function deadlineClass(summary: BoardSummary): string {
  const days = daysUntilDeadline(summary.board.deadline)

  if (days < 0) {
    return 'deadline-status--late'
  }

  if (days <= 7) {
    return 'deadline-status--soon'
  }

  return 'deadline-status--later'
}

function openApplicant(candidateId: string): void {
  profileCandidateId.value = candidateId
  profileOpen.value = true
}
</script>

<template>
  <AppShell>
    <v-alert v-if="store.error" class="orbital-alert mb-6" type="error" density="compact">
      {{ store.error }}
    </v-alert>

    <div class="page-heading">
      <div>
        <p class="eyebrow">Recruitment platform</p>
        <h1 class="page-title">Hiring dashboard.</h1>
        <p class="lede">
          Demand, pipeline health, deadlines, and workload across every department, with the
          applicants who need a next step.
        </p>
      </div>

      <v-btn color="primary" prepend-icon="mdi-view-column-outline" to="/boards">
        Open boards
      </v-btn>
    </div>

    <div v-if="!store.boards.length" class="board-empty dashboard-empty">
      <h2>No role boards yet.</h2>
      <p>Create your first role board to start tracking applicants and hiring progress.</p>
      <v-btn color="primary" prepend-icon="mdi-plus" to="/boards">Open boards</v-btn>
    </div>

    <template v-else>
      <div class="dashboard-filters">
        <span class="mono-label">Filter</span>
        <div class="board-filters">
          <button
            class="board-chip"
            type="button"
            :aria-pressed="selectedDepartment === 'all'"
            @click="selectedDepartment = 'all'"
          >
            All departments
          </button>
          <button
            v-for="group in store.groups"
            :key="group.department"
            class="board-chip"
            type="button"
            :aria-pressed="selectedDepartment === group.department"
            @click="selectDepartment(group.department)"
          >
            {{ group.department }}
          </button>
        </div>
      </div>

      <div class="stat-grid stat-grid--four">
        <article class="stat-card">
          <span class="mono-label">Open positions</span>
          <strong class="stat-value">{{ totals.openPositions }}</strong>
          <span class="stat-meta">
            Across {{ filteredBoards.length }}
            {{ filteredBoards.length === 1 ? 'role board' : 'role boards' }}
          </span>
        </article>
        <article class="stat-card">
          <span class="mono-label">Active candidates</span>
          <strong class="stat-value">{{ totals.active }}</strong>
          <span class="stat-meta">
            {{
              closedCount
                ? `${closedCount} closed ${closedCount === 1 ? 'candidate' : 'candidates'}`
                : 'No closed outcomes yet'
            }}
          </span>
        </article>
        <article class="stat-card">
          <span class="mono-label">Past deadline</span>
          <strong class="stat-value">{{ overdueCount }}</strong>
          <span class="stat-meta">
            {{
              dueSoonCount
                ? `${dueSoonCount} due in the next 14 days`
                : 'No deadlines in the next 14 days'
            }}
          </span>
        </article>
        <article class="stat-card">
          <span class="mono-label">Hired</span>
          <strong class="stat-value">{{ totals.hired }}</strong>
          <span class="stat-meta">
            <template v-if="conversion === null">No closed outcomes yet</template>
            <template v-else>
              {{ totals.rejected }} rejected &middot; {{ conversion }}% of closed candidates
            </template>
          </span>
        </article>
      </div>

      <div class="dashboard-grid dashboard-grid--charts">
        <section class="data-panel" aria-labelledby="workload-title">
          <div class="data-panel-head">
            <div>
              <p class="mono-label">Workload</p>
              <h2 id="workload-title" class="panel-title mt-1">Workload by department</h2>
            </div>
            <span class="status-badge">
              {{ selectedDepartment === 'all' ? 'All departments' : selectedDepartment }}
            </span>
          </div>

          <div class="data-panel-body">
            <div class="dashboard-legend">
              <span class="dashboard-legend__item">
                <span class="dashboard-legend__swatch dashboard-legend__swatch--open" />
                Open positions
              </span>
              <span class="dashboard-legend__item">
                <span class="dashboard-legend__swatch dashboard-legend__swatch--active" />
                Active candidates
              </span>
            </div>

            <DepartmentLoadChart
              :rows="departmentRows"
              :selected="selectedDepartment"
              @select="selectDepartment"
            />
          </div>
        </section>

        <section class="data-panel" aria-labelledby="outcomes-title">
          <div class="data-panel-head">
            <div>
              <p class="mono-label">Outcomes</p>
              <h2 id="outcomes-title" class="panel-title mt-1">Candidate outcomes</h2>
            </div>
            <span v-if="totalCandidates" class="status-badge">{{ totalCandidates }} total</span>
          </div>

          <div class="data-panel-body">
            <OutcomeDonut
              :active="totals.active"
              :hired="totals.hired"
              :rejected="totals.rejected"
            />
          </div>
        </section>
      </div>

      <section class="data-panel dashboard-panel" aria-labelledby="roles-title">
        <div class="data-panel-head">
          <div>
            <p class="mono-label">Roles</p>
            <h2 id="roles-title" class="panel-title mt-1">Role performance</h2>
          </div>
          <RouterLink class="text-link" to="/boards">All boards</RouterLink>
        </div>

        <div class="data-panel-body dashboard-table-body">
          <RolePerformanceTable :summaries="summaries" />
        </div>
      </section>

      <div class="dashboard-grid dashboard-grid--lists">
        <section class="data-panel" aria-labelledby="deadlines-title">
          <div class="data-panel-head">
            <div>
              <p class="mono-label">Attention</p>
              <h2 id="deadlines-title" class="panel-title mt-1">Deadline watch</h2>
            </div>
            <span class="status-badge">{{ overdueCount }} overdue</span>
          </div>

          <div class="data-panel-body">
            <RouterLink
              v-for="summary in deadlineRows"
              :key="summary.board.id"
              class="attention-row"
              :to="{ name: 'board', params: { boardId: summary.board.id } }"
            >
              <div>
                <p class="attention-title">{{ summary.board.name }}</p>
                <p class="attention-meta">
                  {{ summary.board.department }} &middot; {{ summary.active }} active &middot;
                  {{ summary.board.openPositions }} open &middot; due
                  {{ formatDeadline(summary.board.deadline) }}
                </p>
              </div>
              <span class="deadline-status" :class="deadlineClass(summary)">
                {{ deadlineLabel(summary) }}
              </span>
              <v-icon icon="mdi-chevron-right" size="20" />
            </RouterLink>
          </div>
        </section>

        <section class="data-panel" aria-labelledby="applicants-title">
          <div class="data-panel-head">
            <div>
              <p class="mono-label">Pipeline</p>
              <h2 id="applicants-title" class="panel-title mt-1">Applicants to watch</h2>
            </div>
            <RouterLink class="text-link" to="/boards">Open boards</RouterLink>
          </div>

          <div class="data-panel-body">
            <div class="watch-pair">
              <div class="watch-pair__section">
                <h3 class="watch-pair__title">Newest applicants</h3>
                <ApplicantWatchList
                  :entries="newestEntries"
                  mode="newest"
                  empty-label="No applicants in this scope yet."
                  @open="openApplicant"
                />
              </div>

              <div class="watch-pair__section">
                <h3 class="watch-pair__title">Longest in current step</h3>
                <ApplicantWatchList
                  :entries="longestEntries"
                  mode="step"
                  empty-label="No active applicants in this scope yet."
                  @open="openApplicant"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <ApplicantDrawer v-model="profileOpen" :candidate-id="profileCandidateId" />
  </AppShell>
</template>
