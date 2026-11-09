<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const provider = computed(() => auth.user?.app_metadata.provider ?? 'email')

const fullName = ref(auth.fullName)
const fullNameSaving = ref(false)
const fullNameSaved = ref(false)
const fullNameError = ref('')

const password = ref('')
const confirmation = ref('')
const showPassword = ref(false)
const passwordSaving = ref(false)
const passwordSaved = ref(false)
const passwordError = ref('')
const passwordForm = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const passwordRules = [
  (value: string) => Boolean(value) || 'Password is required',
  (value: string) => value.length >= 8 || 'Use at least 8 characters',
]

const confirmationRules = [
  (value: string) => Boolean(value) || 'Confirm your password',
  (value: string) => value === password.value || 'Passwords do not match',
]

watch(
  () => auth.fullName,
  (value) => {
    fullName.value = value
  },
)

const expiryDate = computed(() =>
  auth.session?.expires_at ? new Date(auth.session.expires_at * 1000) : null,
)

const sessionExpiry = computed(() => expiryDate.value?.toLocaleString() ?? 'Unknown')

const sessionExpiryShort = computed(
  () =>
    expiryDate.value?.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) ?? 'Unknown',
)

async function signOut(): Promise<void> {
  await auth.signOut()
  await router.replace('/')
}

async function saveFullName(): Promise<void> {
  fullNameError.value = ''
  fullNameSaved.value = false

  if (!fullName.value.trim()) {
    fullNameError.value = 'Enter your full name.'
    return
  }

  fullNameSaving.value = true
  const saved = await auth.updateFullName(fullName.value)
  fullNameSaving.value = false

  if (saved) {
    fullNameSaved.value = true
    return
  }

  fullNameError.value = auth.error ?? 'Your full name could not be saved.'
}

async function savePassword(): Promise<void> {
  const validation = await passwordForm.value?.validate()
  if (!validation?.valid) {
    return
  }

  passwordError.value = ''
  passwordSaved.value = false
  passwordSaving.value = true
  const updated = await auth.setPassword(password.value)
  passwordSaving.value = false

  if (!updated) {
    passwordError.value = auth.error ?? 'Your password could not be updated.'
    return
  }

  passwordSaved.value = true
  password.value = ''
  confirmation.value = ''
}
</script>

<template>
  <AppShell>
    <v-alert v-if="auth.error && !fullNameError && !passwordError" class="mb-6" type="error">
      {{ auth.error }}
    </v-alert>

    <div class="page-heading">
      <div>
        <p class="eyebrow">Account</p>
        <h1 class="page-title">Account.</h1>
        <p class="lede">Your Supabase identity, active session, and access details at a glance.</p>
      </div>

      <v-btn :loading="auth.loading" prepend-icon="mdi-logout" variant="outlined" @click="signOut">
        Sign out
      </v-btn>
    </div>

    <div class="stat-grid">
      <article class="stat-card">
        <span class="mono-label">Session</span>
        <strong class="stat-value">Active</strong>
        <span class="stat-meta">JWT held in Pinia memory</span>
      </article>
      <article class="stat-card">
        <span class="mono-label">Provider</span>
        <strong class="stat-value">{{ provider }}</strong>
        <span class="stat-meta">Supabase Auth</span>
      </article>
      <article class="stat-card">
        <span class="mono-label">Expires</span>
        <strong class="stat-value">{{ sessionExpiryShort }}</strong>
        <span class="stat-meta">Auto-refresh enabled</span>
      </article>
    </div>

    <div class="account-grid">
      <section class="data-panel" aria-labelledby="identity-title">
        <div class="data-panel-head">
          <div>
            <p class="mono-label">Identity record</p>
            <h2 id="identity-title" class="panel-title mt-1">Account details</h2>
          </div>
          <span class="status-badge">Supabase auth</span>
        </div>

        <div class="data-panel-body">
          <div class="identity-row">
            <span class="identity-index">01</span>
            <div>
              <span class="identity-label">Full name</span>
              <p class="identity-value">{{ auth.fullName || 'Not set' }}</p>
            </div>
            <v-icon class="identity-icon" icon="mdi-account-outline" size="20" />
          </div>

          <div class="identity-row">
            <span class="identity-index">02</span>
            <div>
              <span class="identity-label">Email</span>
              <p class="identity-value">{{ auth.user?.email ?? 'Unknown' }}</p>
            </div>
            <v-icon class="identity-icon" icon="mdi-email-outline" size="20" />
          </div>

          <div class="identity-row">
            <span class="identity-index">03</span>
            <div>
              <span class="identity-label">User ID</span>
              <p class="identity-value identity-value--mono">{{ auth.user?.id ?? 'Unknown' }}</p>
            </div>
            <v-icon class="identity-icon" icon="mdi-identifier" size="20" />
          </div>

          <div class="identity-row">
            <span class="identity-index">04</span>
            <div>
              <span class="identity-label">Auth provider</span>
              <p class="identity-value">{{ provider }}</p>
            </div>
            <v-icon class="identity-icon" icon="mdi-shield-account-outline" size="20" />
          </div>

          <div class="identity-row">
            <span class="identity-index">05</span>
            <div>
              <span class="identity-label">Session expires</span>
              <p class="identity-value">{{ sessionExpiry }}</p>
            </div>
            <v-icon class="identity-icon" icon="mdi-clock-outline" size="20" />
          </div>
        </div>
      </section>

      <aside class="aside-stack">
        <section class="data-panel" aria-labelledby="status-title">
          <div class="data-panel-head">
            <div>
              <p class="mono-label">Connection</p>
              <h2 id="status-title" class="panel-title mt-1">Session status</h2>
            </div>
          </div>

          <div class="data-panel-body">
            <div class="signal-card">
              <span class="status-dot" />
              <div>
                <strong>Session active</strong>
                <span>Supabase Auth / auto-refresh</span>
              </div>
            </div>

            <dl class="meta-list mt-3">
              <div>
                <dt>Expires</dt>
                <dd>{{ sessionExpiry }}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{{ provider }}</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>In-memory Pinia store</dd>
              </div>
            </dl>
          </div>
        </section>

        <div class="auth-note">
          <v-icon icon="mdi-shield-lock-outline" size="18" />
          <p>
            Your session is managed by Supabase Auth. Signing out clears it from this browser and
            returns you to secure access.
          </p>
        </div>
      </aside>
    </div>

    <div class="account-grid account-grid--settings">
      <section class="data-panel" aria-labelledby="profile-settings-title">
        <div class="data-panel-head">
          <div>
            <p class="mono-label">Profile</p>
            <h2 id="profile-settings-title" class="panel-title mt-1">Full name</h2>
          </div>
          <span class="status-badge">Account</span>
        </div>

        <div class="data-panel-body account-form">
          <v-alert v-if="fullNameError" density="compact" type="error">
            {{ fullNameError }}
          </v-alert>
          <v-alert v-else-if="fullNameSaved" density="compact" type="success">
            Full name saved.
          </v-alert>

          <v-text-field
            v-model="fullName"
            autocomplete="name"
            hide-details="auto"
            label="Full name"
            prepend-inner-icon="mdi-account-outline"
          />

          <v-btn color="primary" :loading="fullNameSaving" variant="outlined" @click="saveFullName">
            Save full name
          </v-btn>
        </div>
      </section>

      <section class="data-panel" aria-labelledby="password-settings-title">
        <div class="data-panel-head">
          <div>
            <p class="mono-label">Security</p>
            <h2 id="password-settings-title" class="panel-title mt-1">Reset password</h2>
          </div>
          <span class="status-badge">Supabase auth</span>
        </div>

        <v-form
          ref="passwordForm"
          class="data-panel-body account-form"
          @submit.prevent="savePassword"
        >
          <v-alert v-if="passwordError" density="compact" type="error">
            {{ passwordError }}
          </v-alert>
          <v-alert v-else-if="passwordSaved" density="compact" type="success">
            Password updated.
          </v-alert>

          <v-text-field
            v-model="password"
            autocomplete="new-password"
            label="New password"
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
            prepend-inner-icon="mdi-lock-check-outline"
            required
            :rules="confirmationRules"
            :type="showPassword ? 'text' : 'password'"
          />

          <v-btn color="primary" :loading="passwordSaving" type="submit" variant="outlined">
            Update password
          </v-btn>
        </v-form>
      </section>
    </div>
  </AppShell>
</template>
