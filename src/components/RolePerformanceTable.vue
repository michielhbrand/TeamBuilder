<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PipelineBar from '@/components/PipelineBar.vue'
import { daysUntilDeadline, formatDeadline } from '@/lib/pipeline'
import type { BoardSummary } from '@/types/pipeline'

type SortKey =
  'role' | 'department' | 'openPositions' | 'active' | 'hired' | 'rejected' | 'deadline'
type SortDirection = 'asc' | 'desc'

const props = defineProps<{
  summaries: BoardSummary[]
}>()

const router = useRouter()
const sortKey = ref<SortKey>('deadline')
const sortDirection = ref<SortDirection>('asc')

const sortedRows = computed(() => {
  const direction = sortDirection.value === 'asc' ? 1 : -1

  return [...props.summaries].sort((a, b) => compare(a, b, sortKey.value) * direction)
})

function compare(a: BoardSummary, b: BoardSummary, key: SortKey): number {
  switch (key) {
    case 'role':
      return a.board.name.localeCompare(b.board.name)
    case 'department':
      return (
        a.board.department.localeCompare(b.board.department) ||
        a.board.name.localeCompare(b.board.name)
      )
    case 'openPositions':
      return a.board.openPositions - b.board.openPositions
    case 'active':
      return a.active - b.active
    case 'hired':
      return a.hired - b.hired
    case 'rejected':
      return a.rejected - b.rejected
    case 'deadline':
      return a.board.deadline.localeCompare(b.board.deadline)
  }
}

function toggleSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortKey.value = key
  sortDirection.value =
    key === 'role' || key === 'department' || key === 'deadline' ? 'asc' : 'desc'
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) {
    return 'none'
  }

  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function sortIcon(key: SortKey): string {
  if (sortKey.value !== key) {
    return 'mdi-unfold-more-horizontal'
  }

  return sortDirection.value === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'
}

function deadlineStatus(summary: BoardSummary): string {
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

function openBoard(boardId: string): void {
  void router.push({ name: 'board', params: { boardId } })
}
</script>

<template>
  <p v-if="!summaries.length" class="overview-empty">No role boards in this scope.</p>

  <div v-else class="dashboard-table-wrap">
    <table class="dashboard-table">
      <thead>
        <tr>
          <th scope="col" :aria-sort="ariaSort('role')">
            <button class="dashboard-table__sort" type="button" @click="toggleSort('role')">
              Role
              <v-icon :icon="sortIcon('role')" size="14" />
            </button>
          </th>
          <th scope="col" :aria-sort="ariaSort('department')">
            <button class="dashboard-table__sort" type="button" @click="toggleSort('department')">
              Department
              <v-icon :icon="sortIcon('department')" size="14" />
            </button>
          </th>
          <th scope="col" :aria-sort="ariaSort('openPositions')">
            <button
              class="dashboard-table__sort"
              type="button"
              @click="toggleSort('openPositions')"
            >
              Open
              <v-icon :icon="sortIcon('openPositions')" size="14" />
            </button>
          </th>
          <th scope="col" :aria-sort="ariaSort('active')">
            <button class="dashboard-table__sort" type="button" @click="toggleSort('active')">
              Active
              <v-icon :icon="sortIcon('active')" size="14" />
            </button>
          </th>
          <th scope="col">Pipeline</th>
          <th scope="col" :aria-sort="ariaSort('hired')">
            <button class="dashboard-table__sort" type="button" @click="toggleSort('hired')">
              Hired
              <v-icon :icon="sortIcon('hired')" size="14" />
            </button>
          </th>
          <th scope="col" :aria-sort="ariaSort('rejected')">
            <button class="dashboard-table__sort" type="button" @click="toggleSort('rejected')">
              Rejected
              <v-icon :icon="sortIcon('rejected')" size="14" />
            </button>
          </th>
          <th scope="col" :aria-sort="ariaSort('deadline')">
            <button class="dashboard-table__sort" type="button" @click="toggleSort('deadline')">
              Deadline
              <v-icon :icon="sortIcon('deadline')" size="14" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="summary in sortedRows"
          :key="summary.board.id"
          @click="openBoard(summary.board.id)"
        >
          <td>
            <RouterLink
              class="dashboard-table__role"
              :to="{ name: 'board', params: { boardId: summary.board.id } }"
              @click.stop
            >
              {{ summary.board.name }}
            </RouterLink>
          </td>
          <td class="dashboard-table__muted">{{ summary.board.department }}</td>
          <td class="dashboard-table__num">{{ summary.board.openPositions }}</td>
          <td class="dashboard-table__num">{{ summary.active }}</td>
          <td class="dashboard-table__pipeline">
            <PipelineBar :steps="summary.board.steps" :counts="summary.pipelineCounts" />
          </td>
          <td class="dashboard-table__num">{{ summary.hired }}</td>
          <td class="dashboard-table__num">{{ summary.rejected }}</td>
          <td>
            <span
              class="dashboard-table__date"
              :class="{ 'dashboard-table__date--late': summary.overdue }"
            >
              {{ formatDeadline(summary.board.deadline) }}
            </span>
            <span
              class="dashboard-table__status"
              :class="{ 'dashboard-table__status--late': summary.overdue }"
            >
              {{ deadlineStatus(summary) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
