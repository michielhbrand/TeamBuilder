<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

onMounted(() => auth.clearError())

const password = ref('')
const confirmation = ref('')
const showPassword = ref(false)
const success = ref(false)
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const isInvite = computed(() => auth.passwordSetupRequired)
const needsLinkConfirmation = computed(() => Boolean(auth.linkTokenHash))
const eyebrow = computed(() => {
  if (isInvite.value) {
    return 'Invitation'
  }

  return auth.isAuthenticated ? 'Account security' : 'Secure access'
})
const title = computed(() => {
  if (isInvite.value) {
    return 'Set your password.'
  }

  return auth.isAuthenticated ? 'Update your password.' : 'Password access.'
})
const subtitle = computed(() =>
  auth.isAuthenticated
    ? `Choose a password for ${auth.user?.email ?? 'your account'}.`
    : 'Open the link from your email to continue to your workspace.',
)
const panelSub = computed(() => {
  if (isInvite.value) {
    return 'Welcome. Choose a password to finish setting up your account.'
  }

  return auth.isAuthenticated
    ? 'Choose a new password for your account.'
    : 'Open the link from your email to continue.'
})
const panelTitle = computed(() => {
  if (isInvite.value) {
    return 'Choose a password'
  }

  return auth.isAuthenticated ? 'New password' : 'Link required'
})
const footerLabel = computed(() => {
  if (auth.isAuthenticated) {
    return 'Already set a password?'
  }

  return needsLinkConfirmation.value ? 'Prefer to sign in?' : 'Link expired?'
})

const passwordRules = [
  (value: string) => Boolean(value) || 'Password is required',
  (value: string) => value.length >= 8 || 'Use at least 8 characters',
]

const confirmationRules = [
  (value: string) => Boolean(value) || 'Confirm your password',
  (value: string) => value === password.value || 'Passwords do not match',
]

async function confirmLink(): Promise<void> {
  const verified = await auth.verifyLink()
  if (!verified) {
    return
  }

  await router.replace({ name: 'set-password' })
}

async function submit(): Promise<void> {
  const validation = await form.value?.validate()
  if (!validation?.valid) {
    return
  }

  const updated = await auth.setPassword(password.value)
  if (!updated) {
    return
  }

  success.value = true
  await new Promise((resolve) => setTimeout(resolve, 900))
  await router.replace('/overview')
}

async function goToLogin(): Promise<void> {
  if (auth.isAuthenticated) {
    await auth.signOut()
  }

  await router.replace('/')
}
</script>

<template>
  <AuthShell :eyebrow="eyebrow" :subtitle="subtitle" :title="title">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">{{ panelTitle }}</h2>
        <p class="panel-sub">{{ panelSub }}</p>
      </div>
    </div>

    <template v-if="needsLinkConfirmation">
      <v-alert v-if="auth.error" class="mb-5" type="error">
        {{ auth.error }}
      </v-alert>
      <v-alert v-else class="mb-5" type="info">
        Confirm this invitation to continue to password setup.
      </v-alert>

      <v-btn block color="primary" :loading="auth.loading" size="large" @click="confirmLink">
        Continue to set password
        <v-icon end icon="mdi-arrow-right" />
      </v-btn>

      <div class="auth-note">
        <v-icon icon="mdi-shield-lock-outline" size="18" />
        <p>This one-time link is confirmed only when you press continue.</p>
      </div>
    </template>

    <v-alert v-else-if="!auth.isAuthenticated" class="mb-5" type="error">
      {{
        auth.linkError ??
        'This link is invalid or has expired. Ask your administrator for a new invitation, or use Forgot password on the sign-in page.'
      }}
    </v-alert>

    <template v-else>
      <v-alert v-if="success" class="mb-5" type="success">
        Password saved. Taking you to your overview...
      </v-alert>

      <v-alert v-else-if="auth.error" class="mb-5" type="error">
        {{ auth.error }}
      </v-alert>

      <v-form v-if="!success" ref="form" class="auth-form" @submit.prevent="submit">
        <v-text-field
          v-model="password"
          autocomplete="new-password"
          label="New password"
          placeholder="At least 8 characters"
          prepend-inner-icon="mdi-lock-outline"
          required
          :rules="passwordRules"
          :type="showPassword ? 'text' : 'password'"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
        />

        <v-text-field
          v-model="confirmation"
          autocomplete="new-password"
          label="Confirm password"
          placeholder="Repeat it"
          prepend-inner-icon="mdi-lock-check-outline"
          required
          :rules="confirmationRules"
          :type="showPassword ? 'text' : 'password'"
        />

        <v-btn block color="primary" :loading="auth.loading" size="large" type="submit">
          Save password
          <v-icon end icon="mdi-arrow-right" />
        </v-btn>
      </v-form>

      <div v-if="!success" class="auth-note">
        <v-icon icon="mdi-shield-lock-outline" size="18" />
        <p>Use at least 8 characters. Pick something you do not use anywhere else.</p>
      </div>
    </template>

    <div class="auth-panel-footer">
      <span class="meta">{{ footerLabel }}</span>
      <v-btn color="primary" variant="text" @click="goToLogin">Sign in</v-btn>
    </div>
  </AuthShell>
</template>
