<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import CareerEntryEditor from '@/components/CareerEntryEditor.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  createCareerEntry,
  entryDuration,
  formatMonth,
  isEntryEmpty,
  sortEntries,
} from '@/lib/career'
import type { CareerEntry, CareerKind } from '@/types/pipeline'

const props = withDefaults(
  defineProps<{
    kind: CareerKind
    entries: CareerEntry[]
    highlightId?: string | null
  }>(),
  { highlightId: null },
)

const emit = defineEmits<{
  'update:entries': [entries: CareerEntry[]]
  hover: [id: string | null]
}>()

const editingId = ref<string | null>(null)
const draft = ref<CareerEntry | null>(null)
const isNew = ref(false)
const deleteId = ref<string | null>(null)
const flashId = ref<string | null>(null)
const error = ref('')
const root = ref<HTMLElement | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined

const copy = computed(() =>
  props.kind === 'experience'
    ? { add: 'Add role', empty: 'No roles added yet.', noun: 'role' }
    : { add: 'Add education', empty: 'No education added yet.', noun: 'qualification' },
)
const ordered = computed(() => sortEntries(props.entries))
const deleteMessage = computed(() => {
  const entry = props.entries.find((item) => item.id === deleteId.value)
  return `Delete ${entry?.title ? `“${entry.title}”` : `this ${copy.value.noun}`}? This cannot be undone.`
})

function startAdd(): void {
  error.value = ''
  draft.value = createCareerEntry()
  editingId.value = draft.value.id
  isNew.value = true
}

function startEdit(entry: CareerEntry): void {
  error.value = ''
  draft.value = { ...entry }
  editingId.value = entry.id
  isNew.value = false
}

function stopEditing(): void {
  draft.value = null
  editingId.value = null
  isNew.value = false
  error.value = ''
}

function save(): void {
  const entry = draft.value

  if (!entry) {
    return
  }

  if (isEntryEmpty(entry)) {
    stopEditing()
    return
  }

  if (!entry.title.trim()) {
    error.value = props.kind === 'experience' ? 'Enter a job title.' : 'Enter a qualification.'
    return
  }

  if (!entry.current && entry.start && entry.end && entry.end < entry.start) {
    error.value = 'The end month must not be before the start month.'
    return
  }

  emit(
    'update:entries',
    isNew.value
      ? [...props.entries, entry]
      : props.entries.map((item) => (item.id === entry.id ? entry : item)),
  )
  stopEditing()
}

function confirmDelete(): void {
  const id = deleteId.value

  if (id) {
    emit(
      'update:entries',
      props.entries.filter((item) => item.id !== id),
    )

    if (editingId.value === id) {
      stopEditing()
    }
  }

  deleteId.value = null
}

function requestDelete(): void {
  if (isNew.value) {
    stopEditing()
    return
  }

  deleteId.value = editingId.value
}

async function focusEntry(id: string): Promise<void> {
  await nextTick()
  const element = root.value?.querySelector<HTMLElement>(`[data-career-id="${id}"]`)

  if (!element) {
    return
  }

  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  flashId.value = id
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashId.value = null
  }, 1400)
}

defineExpose({ focusEntry })
onBeforeUnmount(() => clearTimeout(flashTimer))
</script>

<template>
  <div ref="root" class="career-timeline">
    <ol class="career-timeline__list">
      <li v-if="draft && isNew" class="career-item career-item--editing">
        <span class="career-item__rail"><i class="career-item__dot" /></span>
        <div class="career-card career-card--editing">
          <CareerEntryEditor v-model="draft" :kind="kind" />
          <p v-if="error" class="career-card__error" role="alert">{{ error }}</p>
          <div class="career-card__actions">
            <v-btn color="primary" size="small" prepend-icon="mdi-check" @click="save">Save</v-btn>
            <v-btn size="small" variant="text" @click="stopEditing">Cancel</v-btn>
          </div>
        </div>
      </li>

      <li
        v-for="entry in ordered"
        :key="entry.id"
        class="career-item"
        :class="{
          'career-item--now': entry.current,
          'career-item--editing': editingId === entry.id,
          'career-item--active': highlightId === entry.id,
          'career-item--flash': flashId === entry.id,
        }"
        :data-career-id="entry.id"
        @mouseenter="emit('hover', entry.id)"
        @mouseleave="emit('hover', null)"
      >
        <div v-if="editingId !== entry.id" class="career-item__when">
          <b>{{ entry.current ? 'Present' : formatMonth(entry.end) || '—' }}</b>
          <span>{{ formatMonth(entry.start) || '—' }}</span>
          <small>{{ entryDuration(entry) }}</small>
        </div>
        <span class="career-item__rail"><i class="career-item__dot" /></span>

        <div v-if="editingId === entry.id && draft" class="career-card career-card--editing">
          <CareerEntryEditor v-model="draft" :kind="kind" />
          <p v-if="error" class="career-card__error" role="alert">{{ error }}</p>
          <div class="career-card__actions">
            <v-btn color="primary" size="small" prepend-icon="mdi-check" @click="save">Save</v-btn>
            <v-btn size="small" variant="text" @click="stopEditing">Cancel</v-btn>
            <span class="career-card__spacer" />
            <v-btn
              color="error"
              size="small"
              variant="text"
              prepend-icon="mdi-delete-outline"
              @click="requestDelete"
            >
              Delete
            </v-btn>
          </div>
        </div>

        <div v-else class="career-card">
          <div class="career-card__copy">
            <p class="career-card__title">{{ entry.title || 'Untitled' }}</p>
            <p v-if="entry.organization" class="career-card__org">{{ entry.organization }}</p>
            <p v-if="entry.description" class="career-card__description">
              {{ entry.description }}
            </p>
          </div>
          <v-btn
            icon="mdi-pencil-outline"
            size="small"
            variant="text"
            :aria-label="`Edit ${entry.title || copy.noun}`"
            @click="startEdit(entry)"
          />
        </div>
      </li>
    </ol>

    <p v-if="!entries.length && !draft" class="career-empty">{{ copy.empty }}</p>

    <v-btn
      v-if="!draft"
      class="career-add"
      variant="outlined"
      block
      prepend-icon="mdi-plus"
      @click="startAdd"
    >
      {{ copy.add }}
    </v-btn>

    <ConfirmDialog
      :model-value="deleteId !== null"
      :eyebrow="kind === 'experience' ? 'Work experience' : 'Education'"
      :title="`Delete this ${copy.noun}?`"
      :message="deleteMessage"
      :confirm-label="`Delete ${copy.noun}`"
      @update:model-value="deleteId = null"
      @confirm="confirmDelete"
    />
  </div>
</template>
