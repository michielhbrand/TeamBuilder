<script setup lang="ts">
import { computed } from 'vue'
import PipelineLine from '@/components/PipelineLine.vue'
import { filledShare, openedDaysAgo } from '@/lib/overview'
import { activeCandidates, deadlineLabel, sortBoards } from '@/lib/pipeline'
import type { Board } from '@/types/pipeline'

const props = defineProps<{
  boards: Board[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [boardId: string]
}>()

function plural(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`
}

const rows = computed(() =>
  sortBoards(props.boards, 'deadline').map((board) => {
    const active = activeCandidates(board)
    const filled = filledShare(board)

    return {
      board,
      deadline: deadlineLabel(board),
      hired: filled.hired,
      open: filled.open,
      share: filled.share,
      active: active.length,
      counts: board.steps.map(
        (step) => active.filter((candidate) => candidate.stepId === step.id).length,
      ),
      names: board.steps.map((step) => step.name),
      sub: `${board.department} · opened ${plural(openedDaysAgo(board), 'day')} ago · ${plural(board.steps.length, 'stage')}`,
    }
  }),
)
</script>

<template>
  <p v-if="boards.length === 0" class="ov-empty">No role boards in this department.</p>
  <div v-else class="ov-roles">
    <table class="ov-roles__table">
      <thead>
        <tr>
          <th scope="col">Role</th>
          <th scope="col">Deadline</th>
          <th scope="col">Positions</th>
          <th scope="col" class="ov-roles__num">Active</th>
          <th scope="col">Applicants per stage</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.board.id"
          :class="{ 'is-selected': row.board.id === selectedId }"
        >
          <td class="ov-roles__role">
            <RouterLink
              class="ov-roles__name"
              :to="{ name: 'board', params: { boardId: row.board.id } }"
            >
              {{ row.board.name }}
            </RouterLink>
            <span class="ov-roles__sub">{{ row.sub }}</span>
            <button
              type="button"
              class="ov-roles__focus"
              :aria-pressed="row.board.id === selectedId"
              :aria-label="`Focus ${row.board.name}`"
              @click="emit('select', row.board.id)"
            >
              Focus
            </button>
          </td>
          <td data-label="Deadline">
            <span
              class="ov-roles__deadline"
              :class="{ 'ov-roles__deadline--overdue': row.deadline.overdue }"
            >
              <v-icon
                :icon="
                  row.deadline.overdue ? 'mdi-alert-circle-outline' : 'mdi-calendar-blank-outline'
                "
                size="14"
                aria-hidden="true"
              />
              {{ row.deadline.text }}
            </span>
          </td>
          <td data-label="Positions">
            <div class="ov-roles__positions">
              <span class="ov-roles__filled">{{ row.hired }} of {{ row.open }}</span>
              <span
                class="ov-roles__track"
                role="progressbar"
                aria-valuemin="0"
                :aria-valuemax="row.open"
                :aria-valuenow="row.hired"
                :aria-label="`Positions filled for ${row.board.name}`"
              >
                <i :style="{ width: `${row.share * 100}%` }" />
              </span>
            </div>
          </td>
          <td class="ov-roles__num" data-label="Active">{{ row.active }}</td>
          <td data-label="Applicants per stage">
            <PipelineLine :counts="row.counts" :names="row.names" :label="row.board.name" />
          </td>
        </tr>
      </tbody>
    </table>
    <p class="ov-roles__caption">
      Each line runs from the board's first stage to its last stage, so boards with different stages
      stay comparable. Hover for the stage names.
    </p>
  </div>
</template>
