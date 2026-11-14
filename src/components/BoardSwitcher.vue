<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { isOverdue } from '@/lib/pipeline'
import type { BoardGroup } from '@/types/pipeline'

const props = defineProps<{
  groups: BoardGroup[]
  activeBoardId: string
}>()

const menuOpen = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

const activeBoard = computed(() =>
  props.groups.flatMap((group) => group.boards).find((board) => board.id === props.activeBoardId),
)

const filteredGroups = computed(() => {
  const term = query.value.trim().toLowerCase()

  return props.groups
    .map((group) => ({
      department: group.department,
      boards: group.boards.filter(
        (board) => !term || `${board.name} ${board.department}`.toLowerCase().includes(term),
      ),
    }))
    .filter((group) => group.boards.length > 0)
})

watch(menuOpen, (open) => {
  if (!open) {
    query.value = ''
    return
  }

  void nextTick(() => {
    searchInput.value?.focus()
    searchInput.value?.select()
  })
})

function open(): void {
  menuOpen.value = true
}

function close(): void {
  menuOpen.value = false
}

defineExpose({ open })
</script>

<template>
  <v-menu
    v-model="menuOpen"
    :close-on-content-click="false"
    content-class="board-switcher-menu"
    location="bottom end"
    :offset="8"
  >
    <template #activator="{ props: menuProps }">
      <button
        v-bind="menuProps"
        class="board-switcher"
        type="button"
        :aria-label="`Switch board. Current board: ${activeBoard?.name ?? 'unknown'}`"
      >
        <span class="board-switcher__label">
          <span class="meta">Switch board</span>
          <span class="board-switcher__title">{{ activeBoard?.name }}</span>
        </span>
        <v-icon icon="mdi-chevron-down" size="18" />
      </button>
    </template>

    <div class="board-switcher__panel">
      <input
        ref="searchInput"
        v-model="query"
        class="board-search board-switcher__search"
        type="search"
        placeholder="Search roles or teams"
        aria-label="Search roles or teams"
        autocomplete="off"
      />

      <div v-if="filteredGroups.length" class="board-switcher__groups">
        <section
          v-for="group in filteredGroups"
          :key="group.department"
          class="board-switcher__group"
        >
          <p class="meta">{{ group.department }}</p>
          <RouterLink
            v-for="board in group.boards"
            :key="board.id"
            :to="{ name: 'board', params: { boardId: board.id } }"
            class="board-switcher__option"
            :class="{ 'board-switcher__option--active': board.id === activeBoardId }"
            :aria-current="board.id === activeBoardId ? 'page' : undefined"
            @click="close"
          >
            <span class="board-switcher__option-title">{{ board.name }}</span>
            <span v-if="isOverdue(board)" class="board-switcher__option-meta"> Past due </span>
          </RouterLink>
        </section>
      </div>

      <p v-else class="board-switcher__empty">No roles match. Try a different search.</p>
    </div>
  </v-menu>
</template>
