<script setup lang="ts">
import { computed } from 'vue'
import { useChartHover } from '@/lib/chart-tooltip'
import type { RoleFlow } from '@/lib/overview'

const props = defineProps<{
  rows: RoleFlow[]
  selectedId: string | null
}>()

defineEmits<{ select: [boardId: string] }>()

const hover = useChartHover()
const max = computed(() => Math.max(1, ...props.rows.map((row) => row.total)))

function lengthFor(row: RoleFlow): string {
  return `${(row.total / max.value) * 100}%`
}
</script>

<template>
  <div
    class="ov-flow"
    role="group"
    aria-label="Applicants in versus decisions per role, select a role to focus it"
  >
    <button
      v-for="row in rows"
      :key="row.boardId"
      type="button"
      class="ov-flow__row"
      :aria-pressed="selectedId === row.boardId ? 'true' : 'false'"
      v-bind="
        hover(
          row.name,
          `${row.total} applicants in · ${row.hired} hired · ${row.rejected} rejected · ${row.active} still active`,
        )
      "
      @click="$emit('select', row.boardId)"
    >
      <span class="ov-flow__label" :title="row.name">
        <span v-if="selectedId === row.boardId" class="ov-flow__dot" aria-hidden="true" />{{
          row.name
        }}
      </span>
      <span class="ov-flow__bars" aria-hidden="true">
        <template v-if="row.total > 0">
          <span class="ov-flow__bar ov-flow__bar--in" :style="{ width: lengthFor(row) }"
            ><i
          /></span>
          <span class="ov-flow__bar" :style="{ width: lengthFor(row) }">
            <i v-if="row.hired > 0" class="ov-flow__seg--hired" :style="{ flex: row.hired }" />
            <i
              v-if="row.rejected > 0"
              class="ov-flow__seg--rejected"
              :style="{ flex: row.rejected }"
            />
            <i v-if="row.active > 0" :style="{ flex: row.active }" />
          </span>
        </template>
      </span>
      <span class="ov-flow__count">
        <b>{{ row.total }}</b> in / {{ row.hired + row.rejected }} decided
      </span>
      <span class="sr-only">
        {{ row.hired }} hired, {{ row.rejected }} rejected, {{ row.active }} still active
      </span>
    </button>
  </div>
</template>
