<script setup lang="ts">
import { computed } from 'vue'
import { formatRelativeTime } from '@/lib/applicant-events'
import type { ApplicantEvent, ApplicantEventAction, Board } from '@/types/pipeline'

const props = defineProps<{
  events: ApplicantEvent[]
  boards: Board[]
}>()

const icons: Record<ApplicantEventAction, string> = {
  created: 'mdi-account-plus-outline',
  moved: 'mdi-arrow-right-bold-outline',
  edited: 'mdi-pencil-outline',
  hired: 'mdi-check-circle-outline',
  rejected: 'mdi-close-circle-outline',
  reopened: 'mdi-restore',
  analyzed: 'mdi-text-box-search-outline',
}

const boardNames = computed(() => new Map(props.boards.map((board) => [board.id, board.name])))

const rows = computed(() =>
  props.events.map((event) => ({
    id: event.id,
    icon: icons[event.action] ?? 'mdi-circle-small',
    message: event.message,
    board: boardNames.value.get(event.boardId) ?? '',
    time: formatRelativeTime(event.createdAt),
  })),
)
</script>

<template>
  <p v-if="events.length === 0" class="ov-empty">No recent activity.</p>
  <ul v-else class="ov-feed">
    <li v-for="row in rows" :key="row.id">
      <span class="ov-queue__icon">
        <v-icon :icon="row.icon" size="18" aria-hidden="true" />
      </span>
      <div class="ov-feed__text">
        {{ row.message }}
        <small>
          <template v-if="row.board">{{ row.board }} · </template>{{ row.time }}
        </small>
      </div>
    </li>
  </ul>
</template>
