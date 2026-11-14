<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import BoardFormDialog from '@/components/BoardFormDialog.vue'
import BoardList from '@/components/BoardList.vue'
import PageHeader from '@/components/PageHeader.vue'
import { isOverdue } from '@/lib/pipeline'
import { useBoardsStore } from '@/stores/boards'
import type { Board } from '@/types/pipeline'

const store = useBoardsStore()
const router = useRouter()
const createOpen = ref(false)

const roleCount = computed(() => store.boards.length)
const departmentCount = computed(() => store.groups.length)
const overdueCount = computed(() => store.boards.filter((board) => isOverdue(board)).length)

function onCreated(board: Board): void {
  createOpen.value = false
  void router.push({ name: 'board', params: { boardId: board.id } })
}
</script>

<template>
  <AppShell>
    <v-alert v-if="store.error" class="orbital-alert mb-6" type="error" density="compact">
      {{ store.error }}
    </v-alert>

    <PageHeader title="Boards">
      <template #meta>
        <span>
          {{ roleCount }} {{ roleCount === 1 ? 'role' : 'roles' }} across {{ departmentCount }}
          {{ departmentCount === 1 ? 'department' : 'departments' }}
        </span>
        <span v-if="overdueCount > 0" class="boards-meta__late">
          &middot; {{ overdueCount }} past deadline
        </span>
      </template>
    </PageHeader>

    <BoardList :groups="store.groups" @create="createOpen = true" />

    <BoardFormDialog v-model="createOpen" @saved="onCreated" />
  </AppShell>
</template>
