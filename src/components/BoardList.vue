<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PipelineBar from '@/components/PipelineBar.vue'
import {
  activeCandidates,
  deadlineLabel,
  isOverdue,
  sortBoards,
  stageBreakdown,
  summariseBoard,
} from '@/lib/pipeline'
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
const sortKey = ref<'deadline' | 'name' | 'active'>('deadline')
const searchInput = ref<HTMLInputElement | null>(null)

const allBoards = computed(() => props.groups.flatMap((group) => group.boards))
const totalCount = computed(() => allBoards.value.length)
const attentionCount = computed(() => allBoards.value.filter((board) => isOverdue(board)).length)

const filteredGroups = computed(() => {
  const term = query.value.trim().toLowerCase()

  return props.groups
    .map((group) => ({
      department: group.department,
      boards: sortBoards(group.boards, sortKey.value).filter((board) => {
        const matchesQuery =
          !term || `${board.name} ${board.department}`.toLowerCase().includes(term)
        const matchesFilter = !attentionOnly.value || isOverdue(board)
        return matchesQuery && matchesFilter
      }),
    }))
    .filter((group) => group.boards.length > 0)
})

const hasBoards = computed(() => props.groups.some((group) => group.boards.length > 0))

function activeCount(board: Board): number {
  return activeCandidates(board).length
}

function breakdown(board: Board) {
  return stageBreakdown(board)
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
      <div class="board-search-field">
        <v-icon icon="mdi-magnify" size="18" aria-hidden="true" />
        <input
          ref="searchInput"
          v-model="query"
          class="board-search"
          type="search"
          placeholder="Search roles or teams"
          aria-label="Search roles or teams"
          autocomplete="off"
        />
        <kbd class="board-search-field__kbd" aria-hidden="true">/</kbd>
      </div>
      <div class="board-filters">
        <button
          class="board-chip"
          type="button"
          :aria-pressed="!attentionOnly"
          @click="attentionOnly = false"
        >
          All {{ totalCount }}
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
      <label class="board-sort">
        <span class="mono-label">Sort</span>
        <select v-model="sortKey" class="board-search board-sort__select" aria-label="Sort roles">
          <option value="deadline">Deadline (soonest)</option>
          <option value="name">Name</option>
          <option value="active">Most active</option>
        </select>
      </label>
      <v-btn
        class="board-toolbar__create"
        color="primary"
        prepend-icon="mdi-plus"
        @click="emit('create')"
      >
        New board
      </v-btn>
    </div>

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
              <h3>{{ board.name }}</h3>
              <span
                class="board-card__deadline"
                :class="{ 'board-card__deadline--overdue': deadlineLabel(board).overdue }"
              >
                <v-icon
                  :icon="
                    deadlineLabel(board).overdue
                      ? 'mdi-alert-circle-outline'
                      : 'mdi-calendar-blank-outline'
                  "
                  size="14"
                  aria-hidden="true"
                />
                {{ deadlineLabel(board).text }}
              </span>
            </div>
            <dl class="board-card__figures">
              <div>
                <dt>Open</dt>
                <dd>{{ board.openPositions }}</dd>
              </div>
              <div>
                <dt>Active</dt>
                <dd>{{ activeCount(board) }}</dd>
              </div>
            </dl>
            <PipelineBar :steps="board.steps" :counts="pipelineCounts(board)" />
            <p class="board-card__stages">
              <template v-for="(item, index) in breakdown(board).items" :key="item.name">
                <span v-if="index > 0" aria-hidden="true"> &middot; </span>{{ item.name }}
                {{ item.count }}
              </template>
              <template v-if="breakdown(board).hidden > 0">
                &middot; +{{ breakdown(board).hidden }} more
              </template>
            </p>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
