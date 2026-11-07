<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import BoardFormDialog from '@/components/BoardFormDialog.vue'
import BoardList from '@/components/BoardList.vue'
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

    <div class="page-heading">
      <div>
        <p class="eyebrow">Boards</p>
        <h1 class="page-title">Hiring pipelines.</h1>
        <p class="lede">
          One board per open role, grouped by department. Search or filter to find the pipeline that
          needs attention.
        </p>
      </div>

      <div class="board-nav">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">
          New board
        </v-btn>
      </div>
    </div>

    <BoardList :groups="store.groups" @create="createOpen = true" />

    <BoardFormDialog v-model="createOpen" @saved="onCreated" />
  </AppShell>
</template>
