<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PipelineBar from '@/components/PipelineBar.vue'
import { activeCandidates, formatDeadline, isOverdue, summariseBoard } from '@/lib/pipeline'
import type { Board, BoardGroup } from '@/types/pipeline'

const props = defineProps<{
  groups: BoardGroup[]
  activeBoardId?: string
}>()

const emit = defineEmits<{
  create: []
}>()

const query = ref('')
const attentionOnly = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)

const attentionCount = computed(
  () => props.groups.flatMap((group) => group.boards).filter((board) => isOverdue(board)).length,
)

const filteredGroups = computed(() => {
  const term = query.value.trim().toLowerCase()

  return props.groups
    .map((group) => ({
      department: group.department,
      boards: group.boards.filter((board) => {
        const matchesQuery =
          !term || `${board.name} ${board.department}`.toLowerCase().includes(term)
        const matchesFilter = !attentionOnly.value || isOverdue(board)
        return matchesQuery && matchesFilter
      }),
    }))
    .filter((group) => group.boards.length > 0)
})

const visibleCount = computed(() =>
  filteredGroups.value.reduce((total, group) => total + group.boards.length, 0),
)

const hasBoards = computed(() => props.groups.some((group) => group.boards.length > 0))

function activeCount(board: Board): number {
  return activeCandidates(board).length
}

function pipelineCounts(board: Board): number[] {
  return summariseBoard(board).pipelineCounts
}

function resetFilters(): void {
  query.value = ''
  attentionOnly.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey || event.key !== '/') {
    return
  }

  const tag = document.activeElement?.tagName ?? ''

  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return
  }

  event.preventDefault()
  searchInput.value?.focus()
  searchInput.value?.select()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="board-list">
    <div class="board-toolbar">
      <input
        ref="searchInput"
        v-model="query"
        class="board-search"
        type="search"
        placeholder="Search roles or teams"
        aria-label="Search roles or teams"
        autocomplete="off"
      />
      <div class="board-filters">
        <button
          class="board-chip"
          type="button"
          :aria-pressed="!attentionOnly"
          @click="attentionOnly = false"
        >
          All roles
        </button>
        <button
          class="board-chip"
          type="button"
          :aria-pressed="attentionOnly"
          @click="attentionOnly = true"
        >
          Past deadline {{ attentionCount }}
        </button>
      </div>
    </div>

    <p class="board-list__hint">
      Bars show active applicants by stage. Darker segments are further along the process.
      {{ visibleCount }} {{ visibleCount === 1 ? 'role' : 'roles' }} shown.
    </p>

    <div v-if="!hasBoards" class="board-empty">
      <h2>No boards yet.</h2>
      <p>Create your first role board to start tracking applicants.</p>
      <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="emit('create')">
        Create board
      </v-btn>
    </div>

    <div v-else-if="!filteredGroups.length" class="board-empty">
      <h2>No roles match.</h2>
      <p>Try a different search, or show every role.</p>
      <v-btn color="primary" variant="flat" @click="resetFilters">Show all roles</v-btn>
    </div>

    <div v-else class="board-groups">
      <section v-for="group in filteredGroups" :key="group.department" class="board-group">
        <div class="board-group__head">
          <h2>{{ group.department }}</h2>
          <span>{{ group.boards.length }}</span>
        </div>

        <div class="board-grid">
          <RouterLink
            v-for="board in group.boards"
            :key="board.id"
            :to="{ name: 'board', params: { boardId: board.id } }"
            class="board-card"
            :class="{ 'board-card--active': board.id === activeBoardId }"
          >
            <div class="board-card__head">
              <div>
                <h3>{{ board.name }}</h3>
                <p>
                  {{ board.openPositions }} open &middot; {{ activeCount(board) }} active &middot;
                  due {{ formatDeadline(board.deadline) }}
                </p>
              </div>
              <span v-if="isOverdue(board)" class="board-card__late">Past deadline</span>
            </div>
            <PipelineBar :steps="board.steps" :counts="pipelineCounts(board)" />
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
