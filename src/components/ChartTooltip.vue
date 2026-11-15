<script setup lang="ts">
import { useChartTooltipState } from '@/lib/chart-tooltip'

const tooltip = useChartTooltipState()
</script>

<template>
  <div
    v-if="tooltip"
    class="ov-tooltip"
    role="tooltip"
    :data-active="tooltip.active ? 'true' : 'false'"
    :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
  >
    <strong class="ov-tooltip__title">{{ tooltip.title }}</strong>
    <span v-if="tooltip.text">{{ tooltip.text }}</span>
  </div>
</template>
