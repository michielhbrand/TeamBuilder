<script setup lang="ts">
import OverviewSourceTag from '@/components/OverviewSourceTag.vue'

defineProps<{
  label: string
  value: string | number
  unit?: string
  meta: string
  source: 'live' | 'history'
}>()
</script>

<template>
  <article class="ov-kpi">
    <div class="ov-kpi__label">
      <span>{{ label }}</span>
      <OverviewSourceTag :source="source" />
    </div>
    <p class="ov-kpi__value">
      {{ value }}<small v-if="unit" class="ov-kpi__unit">{{ unit }}</small>
    </p>
    <p class="meta ov-kpi__meta">{{ meta }}</p>
    <slot />
  </article>
</template>
