<script setup lang="ts">
import type { AttentionItem } from '@/lib/overview'

defineProps<{
  items: AttentionItem[]
  total: number
}>()

const icons: Record<AttentionItem['kind'], string> = {
  overdue: 'mdi-alert-circle-outline',
  final: 'mdi-handshake-outline',
  stalled: 'mdi-account-search-outline',
  'due-soon': 'mdi-calendar-clock-outline',
}
</script>

<template>
  <div class="ov-queue-wrap">
    <p v-if="items.length === 0" class="ov-empty">
      Nothing needs attention. Every role is within its deadline.
    </p>
    <template v-else>
      <ul class="ov-queue">
        <li v-for="(item, index) in items" :key="`${item.kind}-${item.boardId}-${index}`">
          <span
            class="ov-queue__icon"
            :class="{
              'ov-queue__icon--danger': item.kind === 'overdue',
              'ov-queue__icon--accent': item.kind === 'final',
            }"
          >
            <v-icon :icon="icons[item.kind]" size="18" aria-hidden="true" />
          </span>
          <div class="ov-queue__text">
            {{ item.title }}
            <span>{{ item.detail }}</span>
          </div>
          <RouterLink
            class="ov-queue__link"
            :to="{ name: 'board', params: { boardId: item.boardId } }"
          >
            Open board
          </RouterLink>
        </li>
      </ul>
      <p v-if="total > items.length" class="ov-queue__more">
        Showing {{ items.length }} of {{ total }}.
      </p>
    </template>
  </div>
</template>
