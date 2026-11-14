<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AuthShell from '@/components/AuthShell.vue'
import { isValidEmail } from '@/lib/validation'
import { useAuthStore } from '@/stores/auth'

const RESEND_SECONDS = 30

const auth = useAuthStore()

const email = ref('')
const sent = ref(false)
const countdown = ref(0)
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

const canResend = computed(() => countdown.value === 0 && !auth.loading)

const emailRules = [
  (value: string) => Boolean(value.trim()) || 'Email is required',
  (value: string) => isValidEmail(value) || 'Enter a valid email address',
]

function startCountdown(): void {
  countdown.value = RESEND_SECONDS
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      countdown.value = 0
      clearInterval(timer)
    }
  }, 1000)
}

async function send(): Promise<void> {
  const delivered = await auth.requestPasswordReset(email.value)
  if (!delivered) {
    return
  }

  sent.value = true
  startCountdown()
}

async function submit(): Promise<void> {
  const validation = await form.value?.validate()
  if (!validation?.valid) {
    return
  }

  await send()
}

onMounted(() => auth.clearError())
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <AuthShell
    eyebrow="Password help"
    title="Forgot your password?"
    subtitle="Enter the email your invitation was sent to and we will send you a link to choose a new one."
  >
    <div class="panel-head">
      <div>
        <h2 class="panel-title">Reset your password</h2>
        <p class="panel-sub">We will email you a reset link.</p>
      </div>
    </div>

    <template v-if="sent">
      <v-alert class="mb-5" density="compact" type="success">
        If an account exists for that address, a reset link is on its way.
      </v-alert>

      <v-alert v-if="auth.error" class="mb-5" density="compact" type="error">
        {{ auth.error }}
      </v-alert>

      <v-btn
        block
        color="primary"
        :disabled="!canResend"
        :loading="auth.loading"
        size="large"
        variant="outlined"
        @click="send"
      >
        {{ countdown > 0 ? `Send again in ${countdown}s` : 'Send again' }}
      </v-btn>
    </template>

    <template v-else>
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

        <v-btn block color="primary" :loading="auth.loading" size="large" type="submit">
          Send reset link
          <v-icon end icon="mdi-arrow-right" />
        </v-btn>
      </v-form>
    </template>

    <div class="auth-panel-footer">
      <span class="meta">Remembered it?</span>
      <v-btn color="primary" :to="{ name: 'login' }" variant="text">Back to sign in</v-btn>
    </div>
  </AuthShell>
</template>
