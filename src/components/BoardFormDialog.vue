<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  daysUntilDeadline,
  formatDeadline,
  parseDeadlineInput,
  workDaysUntilDeadline,
} from '@/lib/pipeline'
import { useBoardsStore } from '@/stores/boards'
import type { Board, Department } from '@/types/pipeline'

const props = defineProps<{
  modelValue: boolean
  board?: Board | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [board: Board]
  deleted: [boardId: string]
}>()

const store = useBoardsStore()
const submitting = ref(false)
const deleting = ref(false)
const localError = ref('')
const name = ref('')
const department = ref<Department>('')
const deadline = ref('')
const openPositions = ref<number>(1)
const confirmDeleteOpen = ref(false)

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const departmentOptions = computed(() =>
  [...new Set(store.boards.map((item) => item.department))].sort((a, b) => a.localeCompare(b)),
)

const deadlineIso = computed(() => parseDeadlineInput(deadline.value))
const deadlineIsPast = computed(() => {
  const iso = deadlineIso.value
  return iso ? daysUntilDeadline(iso) < 0 : false
})

const deadlineHint = computed(() => {
  if (!deadline.value.trim()) {
    return ''
  }

  const iso = deadlineIso.value

  if (!iso) {
    return 'Enter a valid date as dd/mm/yyyy.'
  }

  const days = daysUntilDeadline(iso)
  const dayLabel = days === 1 ? 'day' : 'days'

  if (days < 0) {
    const pastDays = Math.abs(days)
    return `${pastDays} ${pastDays === 1 ? 'day' : 'days'} past deadline.`
  }

  if (days === 0) {
    return 'Deadline is today.'
  }

  const workDays = workDaysUntilDeadline(iso)
  const workDayLabel = workDays === 1 ? 'working day' : 'working days'

  return `${days} ${dayLabel} to deadline · ${workDays} ${workDayLabel}`
})

const deleteMessage = computed(
  () =>
    `Delete "${props.board?.name ?? 'this board'}"? All columns and applicants will be permanently deleted. This cannot be undone.`,
)

function defaultDeadline(): string {
  return formatDeadline(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10))
}

function syncForm(): void {
  name.value = props.board?.name ?? ''
  department.value = props.board?.department ?? departmentOptions.value[0] ?? ''
  deadline.value = props.board ? formatDeadline(props.board.deadline) : defaultDeadline()
  openPositions.value = props.board?.openPositions ?? 1
  localError.value = ''
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      syncForm()
    }
  },
)

function requestDelete(): void {
  confirmDeleteOpen.value = true
}

async function deleteBoard(): Promise<void> {
  const board = props.board

  if (!board) {
    return
  }

  deleting.value = true
  const deleted = await store.deleteBoard(board.id)
  deleting.value = false
  confirmDeleteOpen.value = false

  if (deleted) {
    emit('deleted', board.id)
    open.value = false
  }
}

async function submit(): Promise<void> {
  localError.value = ''

  if (!name.value.trim()) {
    localError.value = 'Enter a board name.'
    return
  }

  const departmentValue = department.value.trim()

  if (!departmentValue) {
    localError.value = 'Choose or enter a department.'
    return
  }

  const deadlineValue = parseDeadlineInput(deadline.value)

  if (!deadlineValue) {
    localError.value = 'Enter the deadline as dd/mm/yyyy.'
    return
  }

  const deadlineIsNew = !props.board || deadlineValue !== props.board.deadline

  if (deadlineIsNew && daysUntilDeadline(deadlineValue) < 0) {
    localError.value = 'The deadline cannot be in the past.'
    return
  }

  const positions = Number(openPositions.value)

  if (!Number.isInteger(positions) || positions < 0) {
    localError.value = 'Open positions must be zero or a positive whole number.'
    return
  }

  submitting.value = true

  try {
    if (props.board) {
      const updated = await store.updateBoard(props.board.id, {
        name: name.value.trim(),
        department: departmentValue,
        deadline: deadlineValue,
        openPositions: positions,
      })

      if (updated) {
        const board = store.boardById(props.board.id)
        if (board) emit('saved', board)
        open.value = false
      }
    } else {
      const board = await store.createBoard({
        name: name.value.trim(),
        department: departmentValue,
        deadline: deadlineValue,
        openPositions: positions,
      })

      if (board) {
        emit('saved', board)
        open.value = false
      }
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card class="orbital-dialog">
      <form @submit.prevent="submit">
        <div class="orbital-dialog__head">
          <div>
            <p class="eyebrow">{{ board ? 'Edit board' : 'New board' }}</p>
            <h2 class="panel-title">{{ board ? 'Board settings' : 'Create a role board' }}</h2>
          </div>
          <v-btn icon="mdi-close" variant="text" aria-label="Close" @click="open = false" />
        </div>

        <div class="orbital-dialog__body">
          <v-alert
            v-if="localError || store.error"
            class="orbital-alert"
            type="error"
            density="compact"
          >
            {{ localError || store.error }}
          </v-alert>

          <v-text-field
            v-model="name"
            class="orbital-field"
            label="Board name"
            variant="outlined"
            autofocus
          />

          <div class="orbital-dialog__grid">
            <v-combobox
              v-model="department"
              class="orbital-field"
              label="Department"
              :items="departmentOptions"
              variant="outlined"
              hide-no-data
              autocomplete="off"
            />
            <v-text-field
              v-model="deadline"
              class="orbital-field"
              label="Deadline"
              placeholder="dd/mm/yyyy"
              variant="outlined"
            />
          </div>

          <p
            v-if="deadlineHint"
            class="deadline-readout"
            :class="{ 'deadline-readout--late': deadlineIsPast }"
          >
            {{ deadlineHint }}
          </p>

          <v-text-field
            v-model.number="openPositions"
            class="orbital-field"
            label="Open positions"
            type="number"
            min="0"
            variant="outlined"
          />
        </div>

        <div class="orbital-dialog__actions">
          <v-btn
            v-if="board"
            class="orbital-dialog__danger"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-outline"
            :disabled="submitting || deleting"
            @click="requestDelete"
          >
            Delete board
          </v-btn>
          <v-btn variant="text" @click="open = false">Cancel</v-btn>
          <v-btn color="primary" type="submit" :loading="submitting">
            {{ board ? 'Save changes' : 'Create board' }}
          </v-btn>
        </div>
      </form>
    </v-card>
  </v-dialog>

  <ConfirmDialog
    v-model="confirmDeleteOpen"
    eyebrow="Delete board"
    title="Delete this board?"
    :message="deleteMessage"
    confirm-label="Delete board"
    :loading="deleting"
    @confirm="deleteBoard"
  />
</template>
