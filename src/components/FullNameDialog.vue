<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const name = ref('')
const error = ref('')
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const nameRules = [
  (value: string) => Boolean(value.trim()) || 'Enter your full name',
  (value: string) => value.trim().length >= 2 || 'Use at least 2 characters',
]

watch(
  () => auth.fullNameRequired,
  (required) => {
    if (required) {
      name.value = auth.fullName
      error.value = ''
    }
  },
  { immediate: true },
)

watch(name, () => {
  error.value = ''
})

async function submit(): Promise<void> {
  const validation = await form.value?.validate()
  if (!validation?.valid) {
    return
  }

  const saved = await auth.updateFullName(name.value)
  if (!saved) {
    error.value = auth.error ?? 'Your full name could not be saved.'
  }
}
</script>

<template>
  <v-dialog :model-value="auth.fullNameRequired" persistent max-width="460">
    <v-card class="full-name-dialog">
      <v-card-item>
        <p class="mono-label">Profile</p>
        <v-card-title class="mt-1">Complete your profile</v-card-title>
        <v-card-subtitle>
          Add your full name so teammates can identify you across the workspace.
        </v-card-subtitle>
      </v-card-item>

      <v-card-text>
        <v-alert v-if="error" class="mb-4" density="compact" type="error">
          {{ error }}
        </v-alert>

        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="name"
            autocomplete="name"
            class="mb-4"
            label="Full name"
            prepend-inner-icon="mdi-account-outline"
            required
            :rules="nameRules"
          />

          <v-btn block color="primary" :loading="auth.loading" type="submit">Save full name</v-btn>
        </v-form>

        <p class="full-name-dialog__hint">You can update this later on your account page.</p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
