<script setup lang="ts">
withDefaults(
  defineProps<{
    context?: string
  }>(),
  {
    context: 'Recruitment platform',
  },
)
</script>

<template>
  <div class="brand-lockup">
    <span class="brand-mark" aria-hidden="true">
      <v-icon icon="mdi-google-analytics" size="22" />
    </span>
    <span class="brand-copy">
      <span class="brand-name">TeamBuilder [Beta]</span>
      <span v-if="context" class="brand-context">{{ context }}</span>
    </span>
  </div>
</template>
