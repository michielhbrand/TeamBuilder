<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import BoardFormDialog from '@/components/BoardFormDialog.vue'
import BoardList from '@/components/BoardList.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useBoardsStore } from '@/stores/boards'
import type { Board } from '@/types/pipeline'

const store = useBoardsStore()
const router = useRouter()
const createOpen = ref(false)

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
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">
          New board
        </v-btn>
      </template>
    </PageHeader>

    <BoardList :groups="store.groups" @create="createOpen = true" />

    <BoardFormDialog v-model="createOpen" @saved="onCreated" />
  </AppShell>
</template>
