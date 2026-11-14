<script setup lang="ts">
import { computed, watch } from 'vue'
import type { CareerEntry, CareerKind } from '@/types/pipeline'

const props = defineProps<{
  modelValue: CareerEntry
  kind: CareerKind
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CareerEntry]
}>()

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
        label="Start"
        type="month"
        variant="outlined"
        density="compact"
        hide-details
        :model-value="modelValue.start"
        @update:model-value="patch({ start: String($event ?? '') })"
      />
      <v-text-field
        class="orbital-field"
        label="End"
        type="month"
        variant="outlined"
        density="compact"
        hide-details
        :disabled="modelValue.current"
        :model-value="modelValue.end"
        @update:model-value="patch({ end: String($event ?? '') })"
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
