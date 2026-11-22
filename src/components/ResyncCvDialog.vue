<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    candidateName: string
    busy?: boolean
  }>(),
  {
    busy: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  keep: []
}>()

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function keep(): void {
  if (!props.busy) {
    emit('keep')
    open.value = false
  }
}

function confirm(): void {
  if (!props.busy) {
    emit('confirm')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" :persistent="props.busy">
    <v-card class="orbital-dialog">
      <div class="orbital-dialog__head">
        <div>
          <p class="eyebrow">New CV</p>
          <h2 class="panel-title">Re-sync this profile?</h2>
        </div>
        <v-icon icon="mdi-file-sync-outline" size="28" aria-hidden="true" />
      </div>

      <div class="orbital-dialog__body">
        <p class="confirm-dialog__message">
          The new CV can replace <strong>{{ props.candidateName }}</strong
          >'s education, work experience, and skills. Any corrections made to the current details
          will be lost.
        </p>
        <p class="confirm-dialog__message">
          Keep current details if you only want to replace the CV file.
        </p>
      </div>

      <div class="orbital-dialog__actions">
        <v-btn variant="text" :disabled="props.busy" @click="keep">Keep current details</v-btn>
        <v-btn color="primary" :loading="props.busy" @click="confirm">Re-sync profile</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
