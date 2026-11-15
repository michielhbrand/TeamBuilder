<script setup lang="ts">
import { useId } from 'vue'
import OverviewSourceTag from '@/components/OverviewSourceTag.vue'

defineProps<{
  title: string
  subtitle?: string
  source?: 'live' | 'history'
}>()

const headingId = useId()
</script>

<template>
  <section class="data-panel ov-panel" :aria-labelledby="headingId">
    <header class="ov-panel__head">
      <div class="ov-panel__titles">
        <div class="ov-panel__title-row">
          <h2 :id="headingId" class="ov-panel__title">{{ title }}</h2>
          <OverviewSourceTag v-if="source" :source="source" />
        </div>
        <p v-if="subtitle" class="meta ov-panel__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="ov-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ov-panel__body">
      <slot />
    </div>
  </section>
</template>
