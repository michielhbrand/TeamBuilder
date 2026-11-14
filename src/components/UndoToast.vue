<script setup lang="ts">
import { useUndoStore } from '@/stores/undo'

const undo = useUndoStore()
</script>

<template>
  <div class="undo-toast-region" role="status" aria-live="polite">
    <div v-if="undo.entry" :key="undo.entry.id" class="undo-toast">
      <span class="undo-toast-message">{{ undo.entry.message }}</span>
      <v-btn class="undo-toast-action" size="small" variant="text" @click="undo.run()">
        Undo
      </v-btn>
      <v-btn
        aria-label="Dismiss"
        class="undo-toast-close"
        density="comfortable"
        icon="mdi-close"
        size="small"
        variant="text"
        @click="undo.dismiss()"
      />
    </div>
  </div>
</template>
