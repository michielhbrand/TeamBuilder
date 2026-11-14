<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { applicantsInStage, reorderIds } from '@/lib/pipeline'
import { useBoardsStore } from '@/stores/boards'
import type { Board, PipelineStep } from '@/types/pipeline'

const props = defineProps<{
  modelValue: boolean
  board?: Board | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const store = useBoardsStore()
const drafts = ref<Record<string, string>>({})
const newColumn = ref('')
const movingId = ref<string | null>(null)
const renameTimers = new Map<string, ReturnType<typeof setTimeout>>()

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const steps = computed(() => props.board?.steps ?? [])

function clearRenameTimer(id: string): void {
  const timer = renameTimers.get(id)

  if (timer) {
    clearTimeout(timer)
    renameTimers.delete(id)
  }
}

function clearRenameTimers(): void {
  for (const id of renameTimers.keys()) {
    clearRenameTimer(id)
  }
}

function syncDrafts(): void {
  clearRenameTimers()
  drafts.value = Object.fromEntries(steps.value.map((step) => [step.id, step.name]))
  newColumn.value = ''
}

function setDraft(id: string, value: unknown): void {
  drafts.value[id] = String(value ?? '')
  const step = steps.value.find((item) => item.id === id)

  if (step) {
    scheduleRename(step)
  }
}

function scheduleRename(step: PipelineStep): void {
  const name = (drafts.value[step.id] ?? '').trim()
  clearRenameTimer(step.id)

  if (!name || name === step.name) {
    return
  }

  renameTimers.set(
    step.id,
    setTimeout(() => {
      renameTimers.delete(step.id)
      void rename(step)
    }, 700),
  )
}

watch([() => props.modelValue, () => props.board?.id], ([value]) => {
  if (value) {
    syncDrafts()
  }
})

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      for (const step of steps.value) {
        if (renameTimers.has(step.id)) {
          void rename(step)
        }
      }
    }
  },
)

async function rename(step: PipelineStep): Promise<boolean> {
  clearRenameTimer(step.id)
  const name = (drafts.value[step.id] ?? '').trim()

  if (!name) {
    drafts.value[step.id] = step.name
    return true
  }

  if (name === step.name) {
    return true
  }

  const saved = await store.renameColumn(props.board?.id ?? '', step.id, name)

  if (saved) {
    drafts.value[step.id] = name
    flashSaved()
  }

  return saved
}

async function flushRenames(): Promise<boolean> {
  const results = await Promise.all(steps.value.map((step) => rename(step)))
  return results.every(Boolean)
}

const grabbedId = ref<string | null>(null)
const dragId = ref<string | null>(null)
const dropIndex = ref<number | null>(null)
const announcement = ref('')
const savedVisible = ref(false)
const deleting = ref<PipelineStep | null>(null)
const deleteBusy = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | undefined

function flashSaved(): void {
  savedVisible.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    savedVisible.value = false
  }, 1600)
}

function countLabel(step: PipelineStep): string {
  const count = props.board ? applicantsInStage(props.board, step.id) : 0
  return `${count} ${count === 1 ? 'applicant' : 'applicants'}`
}

async function reorder(from: number, to: number): Promise<boolean> {
  if (!props.board || movingId.value) {
    return false
  }

  const ids = steps.value.map((item) => item.id)
  const reordered = reorderIds(ids, from, to)

  if (reordered.every((id, index) => id === ids[index])) {
    return false
  }

  movingId.value = ids[from] ?? null

  if (!(await flushRenames())) {
    movingId.value = null
    return false
  }

  const saved = await store.reorderColumns(props.board.id, reordered)
  movingId.value = null

  if (saved) {
    syncDrafts()
  }

  return saved
}

function focusHandle(id: string): void {
  void nextTick(() => {
    document.getElementById(`stage-handle-${id}`)?.focus()
  })
}

function toggleGrab(step: PipelineStep): void {
  if (grabbedId.value === step.id) {
    grabbedId.value = null
    announcement.value = `Dropped ${step.name} at position ${steps.value.indexOf(step) + 1} of ${steps.value.length}`
    return
  }

  grabbedId.value = step.id
  announcement.value = `Picked up ${step.name}. Use the up and down arrow keys to move it, then press Space to drop.`
}

async function handleKey(event: KeyboardEvent, step: PipelineStep): Promise<void> {
  if (movingId.value) {
    event.preventDefault()
    return
  }

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    toggleGrab(step)
    return
  }

  if (event.key === 'Escape' && grabbedId.value === step.id) {
    event.stopPropagation()
    grabbedId.value = null
    announcement.value = `Dropped ${step.name}`
    return
  }

  if (grabbedId.value !== step.id || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
    return
  }

  event.preventDefault()
  const from = steps.value.findIndex((item) => item.id === step.id)
  const to = from + (event.key === 'ArrowUp' ? -1 : 1)

  if (to < 1 || to >= steps.value.length) {
    return
  }

  if (await reorder(from, to)) {
    announcement.value = `Moved ${step.name} to position ${to + 1} of ${steps.value.length}`
    focusHandle(step.id)
  }
}

function onHandleBlur(event: FocusEvent): void {
  if (event.relatedTarget) {
    grabbedId.value = null
  }
}

function onDragStart(event: DragEvent, step: PipelineStep): void {
  dragId.value = step.id

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', step.id)
    const row = (event.target as HTMLElement).closest('.column-manage__row')

    if (row) {
      event.dataTransfer.setDragImage(row, 16, 24)
    }
  }
}

function onDragOver(event: DragEvent, index: number): void {
  if (!dragId.value || index < 1) {
    return
  }

  event.preventDefault()
  dropIndex.value = index
}

function onDragEnd(): void {
  dragId.value = null
  dropIndex.value = null
}

async function onDrop(event: DragEvent, index: number): Promise<void> {
  event.preventDefault()
  const id = dragId.value
  onDragEnd()

  if (!id || index < 1) {
    return
  }

  const from = steps.value.findIndex((item) => item.id === id)
  const name = steps.value[from]?.name ?? ''

  if (await reorder(from, index)) {
    announcement.value = `Moved ${name} to position ${index + 1} of ${steps.value.length}`
  }
}

async function add(): Promise<void> {
  const name = newColumn.value.trim()

  if (!name || !props.board || movingId.value) {
    return
  }

  movingId.value = 'add'

  if (!(await flushRenames())) {
    movingId.value = null
    return
  }

  const saved = await store.addColumn(props.board.id, name)
  movingId.value = null

  if (saved) {
    syncDrafts()
  }
}

async function confirmRemove(): Promise<void> {
  const step = deleting.value

  if (!step || !props.board) {
    return
  }

  deleteBusy.value = true
  const saved = (await flushRenames()) && (await store.deleteColumn(props.board.id, step.id))
  deleteBusy.value = false
  deleting.value = null

  if (saved) {
    syncDrafts()
  }
}

const deleteMessage = computed(() => {
  const step = deleting.value
  const first = steps.value[0]

  if (!step || !props.board || !first) {
    return ''
  }

  const count = applicantsInStage(props.board, step.id)

  return count === 0
    ? 'No applicants are in this stage.'
    : `${count} ${count === 1 ? 'applicant' : 'applicants'} will move to ${first.name}.`
})

onBeforeUnmount(() => {
  clearRenameTimers()
  clearTimeout(savedTimer)
})
</script>

<template>
  <v-dialog v-model="open" max-width="660">
    <v-card class="orbital-dialog">
      <div class="orbital-dialog__head">
        <div>
          <p class="eyebrow">Pipeline</p>
          <h2 class="panel-title">Manage stages</h2>
          <p class="column-manage__sub">
            Changes save as you type.
            <span class="column-manage__saved" :class="{ 'is-visible': savedVisible }">
              <v-icon icon="mdi-check" size="14" />Saved
            </span>
          </p>
        </div>
        <v-btn icon="mdi-close" variant="text" aria-label="Close" @click="open = false" />
      </div>

      <div class="orbital-dialog__body">
        <v-alert v-if="store.error" class="orbital-alert" type="error" density="compact">
          {{ store.error }}
        </v-alert>

        <div class="column-manage" role="list">
          <div
            v-for="(step, index) in steps"
            :key="step.id"
            class="column-manage__row"
            :class="{
              'is-dragging': dragId === step.id,
              'is-grabbed': grabbedId === step.id,
              'is-drop': dropIndex === index && dragId !== step.id,
            }"
            role="listitem"
            @dragover="onDragOver($event, index)"
            @drop="onDrop($event, index)"
          >
            <span v-if="index === 0" class="column-manage__grip is-locked" aria-hidden="true">
              <v-icon icon="mdi-lock-outline" size="18" />
            </span>
            <button
              v-else
              :id="`stage-handle-${step.id}`"
              type="button"
              class="column-manage__grip"
              draggable="true"
              :aria-label="`Reorder ${step.name}, position ${index + 1} of ${steps.length}`"
              :aria-pressed="grabbedId === step.id"
              :aria-disabled="movingId !== null"
              @keydown="handleKey($event, step)"
              @blur="onHandleBlur"
              @dragstart="onDragStart($event, step)"
              @dragend="onDragEnd"
            >
              <v-icon icon="mdi-drag-vertical" size="20" />
            </button>
            <v-text-field
              class="orbital-field"
              :model-value="drafts[step.id] ?? step.name"
              :aria-label="`Stage ${index + 1} name`"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="setDraft(step.id, $event)"
              @blur="rename(step)"
              @keyup.enter="rename(step)"
            />
            <span class="column-manage__count">{{ countLabel(step) }}</span>
            <span v-if="index === 0" class="column-manage__default" tabindex="0">
              <span class="column-manage__chip">Default</span>
              <v-tooltip activator="parent" location="top" max-width="260">
                New applicants start here, and deleted stages move their applicants here.
              </v-tooltip>
            </span>
            <v-btn
              v-else
              class="column-manage__delete"
              icon="mdi-trash-can-outline"
              variant="text"
              size="small"
              :aria-label="`Delete ${step.name}`"
              @click="deleting = step"
            />
          </div>
        </div>

        <div class="column-manage__add">
          <v-text-field
            v-model="newColumn"
            class="orbital-field"
            placeholder="New stage name"
            aria-label="New stage name"
            variant="outlined"
            density="compact"
            hide-details
            @keyup.enter="add"
          />
          <v-btn color="primary" variant="outlined" prepend-icon="mdi-plus" @click="add">
            Add stage
          </v-btn>
        </div>

        <p class="column-manage__live" aria-live="polite">{{ announcement }}</p>
      </div>

      <div class="orbital-dialog__actions">
        <v-btn color="primary" @click="open = false">Done</v-btn>
      </div>
    </v-card>
  </v-dialog>

  <ConfirmDialog
    :model-value="deleting !== null"
    :title="`Delete ${deleting?.name ?? 'stage'}?`"
    :message="deleteMessage"
    eyebrow="Stage"
    confirm-label="Delete stage"
    :loading="deleteBusy"
    @update:model-value="deleting = null"
    @confirm="confirmRemove"
  />
</template>
