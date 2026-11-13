<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  candidateName: string
  boardName: string
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function cancel(): void {
  emit('cancel')
  emit('update:modelValue', false)
}

function confirm(): void {
  emit('confirm')
}
</script>

<template>
  <v-dialog
    :model-value="props.modelValue"
    max-width="560"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="orbital-dialog fit-consent">
      <div class="orbital-dialog__head">
        <div>
          <p class="eyebrow">AI analysis</p>
          <h2 class="panel-title">Send this CV to Kilo?</h2>
        </div>
        <v-icon icon="mdi-shield-lock-outline" size="28" aria-hidden="true" />
      </div>

      <div class="orbital-dialog__body fit-consent__body">
        <p class="fit-consent__lead">
          Analyze <strong>{{ props.candidateName }}</strong> against the
          <strong>{{ props.boardName }}</strong> job spec to list similarities and gaps using Kilo's
          free hosted model.
        </p>

        <div class="fit-consent__block">
          <p class="eyebrow">What is sent</p>
          <ul class="fit-consent__list">
            <li>The job spec and role department.</li>
            <li>Education and work experience from this profile.</li>
          </ul>
        </div>

        <div class="fit-consent__block">
          <p class="eyebrow">What is removed</p>
          <ul class="fit-consent__list">
            <li>Name, email, phone, URLs, and address.</li>
            <li>Date of birth, age, gender, nationality, and other sensitive fields.</li>
          </ul>
        </div>

        <v-alert class="orbital-alert" type="warning" density="compact" variant="tonal">
          Kilo may log or train on free-tier requests. Do not send confidential CVs without
          approval. The saved result is visible to everyone signed in to this workspace.
        </v-alert>

        <p class="fit-consent__note">
          You will be asked again before every analysis. Cancelling keeps the previous result.
        </p>
      </div>

      <div class="orbital-dialog__actions">
        <v-btn variant="text" :disabled="props.busy" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" :loading="props.busy" @click="confirm">
          {{ props.busy ? 'Analyzing…' : 'Analyze now' }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
