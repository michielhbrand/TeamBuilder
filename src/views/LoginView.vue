<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { isValidEmail } from '@/lib/validation'
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
  (value: string) => isValidEmail(value) || 'Enter a valid email address',
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
    subtitle="Sign in to manage open roles, applicant pipelines, and interview stages."
  >
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Sign in</h2>
        <p class="panel-sub">Use the email your invitation was sent to.</p>
      </div>
    </div>

    <v-alert v-if="auth.error" class="mb-5" density="compact" type="error">
      {{ auth.error }}
    </v-alert>

    <v-form ref="form" class="auth-form" @submit.prevent="submit">
      <v-text-field
        v-model="email"
        autocomplete="email"
        label="Email"
        placeholder="you@company.com"
        prepend-inner-icon="mdi-email-outline"
        required
        :rules="emailRules"
        type="email"
      />

      <div class="auth-field">
        <router-link class="auth-field__aside" :to="{ name: 'forgot-password' }">
          Forgot password?
        </router-link>
        <v-text-field
          v-model="password"
          autocomplete="current-password"
          label="Password"
          placeholder="Your password"
          prepend-inner-icon="mdi-lock-outline"
          required
          :rules="passwordRules"
          :type="showPassword ? 'text' : 'password'"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
        />
      </div>

      <v-btn block color="primary" :loading="auth.loading" size="large" type="submit">
        Sign in
        <v-icon end icon="mdi-arrow-right" />
      </v-btn>
    </v-form>

    <div class="auth-note">
      <v-icon icon="mdi-email-fast-outline" size="18" />
      <p>
        <strong>Got an invitation?</strong> Open the link in your email to choose a password. No
        invitation? Ask your administrator.
      </p>
    </div>
  </AuthShell>
</template>
