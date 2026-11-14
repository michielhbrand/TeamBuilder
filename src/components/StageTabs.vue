<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { PipelineStep } from '@/types/pipeline'

const props = defineProps<{
  steps: PipelineStep[]
  counts: number[]
  modelValue: string
  panelId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [stepId: string]
}>()

const tabs = ref<HTMLButtonElement[]>([])

function select(index: number): void {
  const step = props.steps[index]

  if (step) {
    emit('update:modelValue', step.id)
    void nextTick(() => {
      tabs.value[index]?.focus()
      tabs.value[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }
}

function onKeydown(event: KeyboardEvent, index: number): void {
  const last = props.steps.length - 1
  const targets: Record<string, number> = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }
  const target = targets[event.key]

  if (target !== undefined) {
    event.preventDefault()
    select(target)
  }
}
</script>

<template>
  <div class="stage-tabs" role="tablist" aria-label="Stages">
    <button
      v-for="(step, index) in steps"
      :id="`stage-tab-${step.id}`"
      :key="step.id"
      ref="tabs"
      class="stage-tabs__tab"
      type="button"
      role="tab"
      :aria-selected="step.id === modelValue"
      :aria-controls="panelId"
      :tabindex="step.id === modelValue ? 0 : -1"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      <span>{{ step.name }}</span>
      <span class="stage-tabs__count">{{ counts[index] ?? 0 }}</span>
    </button>
  </div>
</template>
