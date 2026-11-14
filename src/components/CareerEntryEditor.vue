<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isValidMonth } from '@/lib/career'
import type { CareerEntry, CareerKind } from '@/types/pipeline'

const props = defineProps<{
  modelValue: CareerEntry
  kind: CareerKind
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CareerEntry]
}>()

const DATE_FORMAT_ERROR = 'Use YYYY-MM (for example, 2024-06).'
const startTouched = ref(false)
const endTouched = ref(false)

const labels = computed(() =>
  props.kind === 'experience'
    ? {
        title: 'Job title',
        organization: 'Company',
        current: 'Currently working here',
        description: 'Responsibilities and achievements',
      }
    : {
        title: 'Qualification',
        organization: 'Institution',
        current: 'Still studying',
        description: 'Major, thesis, distinctions',
      },
)

const startError = computed(() => {
  const start = props.modelValue.start

  if (start) {
    return isValidMonth(start) ? '' : DATE_FORMAT_ERROR
  }

  return startTouched.value ? 'Choose a start date.' : ''
})

const endError = computed(() => {
  if (props.modelValue.current) {
    return ''
  }

  const start = props.modelValue.start
  const end = props.modelValue.end

  if (end) {
    if (!isValidMonth(end)) {
      return DATE_FORMAT_ERROR
    }

    if (isValidMonth(start) && end < start) {
      return 'The end date must be on or after the start date.'
    }

    return ''
  }

  return endTouched.value ? 'Choose an end date, or mark this as current.' : ''
})

let latest = props.modelValue

watch(
  () => props.modelValue,
  (value) => {
    latest = value
  },
)

function patch(change: Partial<CareerEntry>): void {
  latest = { ...latest, ...change }
  emit('update:modelValue', latest)
}

function setCurrent(value: unknown): void {
  const current = value === true
  patch(current ? { current, end: '' } : { current })
}
</script>

<template>
  <div class="career-editor">
    <div class="career-editor__row">
      <v-text-field
        class="orbital-field"
        :label="labels.title"
        variant="outlined"
        density="compact"
        hide-details
        autofocus
        :model-value="modelValue.title"
        @update:model-value="patch({ title: String($event ?? '') })"
      />
      <v-text-field
        class="orbital-field"
        :label="labels.organization"
        variant="outlined"
        density="compact"
        hide-details
        :model-value="modelValue.organization"
        @update:model-value="patch({ organization: String($event ?? '') })"
      />
    </div>

    <div class="career-editor__row career-editor__row--dates">
      <v-text-field
        class="orbital-field"
        label="Start date"
        placeholder="YYYY-MM"
        variant="outlined"
        density="compact"
        hide-details="auto"
        autocomplete="off"
        :model-value="modelValue.start"
        :error-messages="startError"
        @update:model-value="patch({ start: String($event ?? '') })"
        @blur="startTouched = true"
      />
      <v-text-field
        class="orbital-field"
        label="End date"
        placeholder="YYYY-MM"
        variant="outlined"
        density="compact"
        hide-details="auto"
        autocomplete="off"
        :disabled="modelValue.current"
        :model-value="modelValue.end"
        :error-messages="endError"
        @update:model-value="patch({ end: String($event ?? '') })"
        @blur="endTouched = true"
      />
      <v-checkbox
        class="career-editor__current"
        density="compact"
        hide-details
        :label="labels.current"
        :model-value="modelValue.current"
        @update:model-value="setCurrent"
      />
    </div>

    <v-textarea
      class="orbital-field"
      :label="labels.description"
      variant="outlined"
      density="compact"
      rows="3"
      auto-grow
      hide-details
      :model-value="modelValue.description"
      @update:model-value="patch({ description: String($event ?? '') })"
    />
  </div>
</template>
