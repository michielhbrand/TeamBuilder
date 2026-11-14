<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const emailRules = [
  (value: string) => Boolean(value) || 'Email is required',
  (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a valid email address',
]

const passwordRules = [(value: string) => Boolean(value) || 'Password is required']

async function submit(): Promise<void> {
  const validation = await form.value?.validate()
  if (!validation?.valid) {
    return
  }

  const signedIn = await auth.signIn(email.value, password.value)
  if (!signedIn) {
    return
  }

  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/overview'
  await router.replace(redirect)
}
</script>

<template>
  <AuthShell
    eyebrow="Secure access"
    title="Welcome back."
    subtitle="Sign in to manage open roles, candidate pipelines, and interview steps."
  >
    <div class="panel-head">
      <div>
        <p class="meta">Account access</p>
        <h2 class="panel-title mt-1">Sign in</h2>
      </div>
      <span class="status-badge">Email</span>
    </div>

    <v-alert v-if="auth.error" class="mb-5" density="compact" type="error">
      {{ auth.error }}
    </v-alert>

    <v-form ref="form" class="auth-form" @submit.prevent="submit">
      <v-text-field
        v-model="email"
        autocomplete="email"
        class="mb-3"
        label="Email"
        prepend-inner-icon="mdi-email-outline"
        required
        :rules="emailRules"
        type="email"
      />

      <v-text-field
        v-model="password"
        autocomplete="current-password"
        class="mb-3"
        label="Password"
        prepend-inner-icon="mdi-lock-outline"
        required
        :rules="passwordRules"
        :type="showPassword ? 'text' : 'password'"
        :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        @click:append-inner="showPassword = !showPassword"
      />

      <v-btn block color="primary" :loading="auth.loading" size="large" type="submit">
        Sign in
        <v-icon end icon="mdi-arrow-right" />
      </v-btn>
    </v-form>

    <div class="auth-note">
      <v-icon icon="mdi-shield-account-outline" size="18" />
      <p>
        Accounts are provisioned by an administrator; sign-up is disabled. If you received an
        invitation email, open its link to choose a password.
      </p>
    </div>
  </AuthShell>
</template>
