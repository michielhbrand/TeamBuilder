<script setup lang="ts">
defineProps<{ source: 'live' | 'history' }>()
</script>

<template>
  <span class="ov-source">{{ source === 'live' ? 'Live boards' : 'History table' }}</span>
</template>
