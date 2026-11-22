<script setup lang="ts">
defineProps<{
  status: 'full' | 'partial' | 'none'
  critical?: boolean
}>()
</script>

<template>
  <svg
    class="fit-glyph"
    :class="[`fit-glyph--${status}`, { 'fit-glyph--critical': critical }]"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="status === 'full'">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path
        d="M6 10.3l2.8 2.8L14.2 7.5"
        fill="none"
        stroke="var(--orbital-accent-ink)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
    <template v-else-if="status === 'partial'">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M10 1.75a8.25 8.25 0 0 0 0 16.5z" fill="currentColor" />
    </template>
    <template v-else>
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M6.5 10h7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </template>
  </svg>
</template>
