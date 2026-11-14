<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import AppShell from '@/components/AppShell.vue'
import PageHeader from '@/components/PageHeader.vue'
import { darkThemeName, lightThemeName, persistTheme } from '@/lib/theme'
import { initials } from '@/lib/pipeline'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const theme = useTheme()

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

const themeName = computed({
  get: () => theme.global.name.value,
  set: (value: string | undefined) => {
    if (value !== lightThemeName && value !== darkThemeName) {
      return
    }
    theme.global.name.value = value
    persistTheme(value)
  },
})

const nameDirty = computed(() => {
  const trimmed = fullName.value.trim()
  return Boolean(trimmed) && trimmed !== auth.fullName
})

const passwordValid = computed(
  () => password.value.length >= 8 && confirmation.value === password.value,
)

const displayName = computed(() => auth.fullName || auth.user?.email || 'Signed in')

const avatarInitials = computed(() =>
  auth.fullName ? initials(auth.fullName) : (auth.user?.email ?? 'TB').slice(0, 2).toUpperCase(),
)

async function signOut(): Promise<void> {
  await auth.signOut()
  await router.replace('/')
}

async function saveFullName(): Promise<void> {
  fullNameError.value = ''
  fullNameSaved.value = false

  if (!nameDirty.value) {
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
  if (!passwordValid.value) {
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
    <PageHeader title="Account" />

    <v-alert v-if="auth.error && !fullNameError && !passwordError" class="mb-6" type="error">
      {{ auth.error }}
    </v-alert>

    <div class="account-column">
      <section class="data-panel" aria-labelledby="profile-title">
        <div class="data-panel-head account-panel-head">
          <div>
            <h2 id="profile-title" class="panel-title">Profile</h2>
            <p class="account-panel-hint">
              Your name appears on notes and in each applicant's activity.
            </p>
          </div>
        </div>

        <form class="data-panel-body account-form" @submit.prevent="saveFullName">
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

          <div>
            <v-text-field
              :model-value="auth.user?.email ?? ''"
              append-inner-icon="mdi-lock-outline"
              class="account-readonly"
              hide-details
              label="Email"
              readonly
            />
            <p class="account-field-hint">Your administrator manages this address.</p>
          </div>

          <div class="account-actions">
            <v-btn
              color="primary"
              :disabled="!nameDirty"
              :loading="fullNameSaving"
              type="submit"
              variant="flat"
            >
              Save changes
            </v-btn>
          </div>
        </form>
      </section>

      <section class="data-panel" aria-labelledby="password-title">
        <div class="data-panel-head account-panel-head">
          <div>
            <h2 id="password-title" class="panel-title">Password</h2>
            <p class="account-panel-hint">At least 8 characters.</p>
          </div>
        </div>

        <form class="data-panel-body account-form" @submit.prevent="savePassword">
          <v-alert v-if="passwordError" density="compact" type="error">
            {{ passwordError }}
          </v-alert>
          <v-alert v-else-if="passwordSaved" density="compact" type="success">
            Password updated.
          </v-alert>

          <div class="account-two-col">
            <v-text-field
              v-model="password"
              autocomplete="new-password"
              label="New password"
              placeholder="At least 8 characters"
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
              :rules="confirmationRules"
              :type="showPassword ? 'text' : 'password'"
            />
          </div>

          <div class="account-actions">
            <v-btn
              color="primary"
              :disabled="!passwordValid"
              :loading="passwordSaving"
              type="submit"
              variant="flat"
            >
              Update password
            </v-btn>
          </div>
        </form>
      </section>

      <section class="data-panel" aria-labelledby="appearance-title">
        <div class="data-panel-body account-row">
          <div>
            <h2 id="appearance-title" class="panel-title">Appearance</h2>
            <p class="account-panel-hint">Applies on this device.</p>
          </div>
          <v-btn-toggle
            v-model="themeName"
            aria-label="Color theme"
            color="primary"
            density="comfortable"
            divided
            mandatory
            variant="outlined"
          >
            <v-btn :value="lightThemeName" prepend-icon="mdi-white-balance-sunny">Light</v-btn>
            <v-btn :value="darkThemeName" prepend-icon="mdi-weather-night">Dark</v-btn>
          </v-btn-toggle>
        </div>
      </section>

      <section class="data-panel" aria-label="Session">
        <div class="data-panel-body account-row">
          <span class="user-avatar account-avatar">{{ avatarInitials }}</span>
          <div class="account-signed">
            <strong>Signed in as {{ displayName }}</strong>
            <span>Sign out to end this session on this device.</span>
          </div>
          <v-btn
            :loading="auth.loading"
            prepend-icon="mdi-logout"
            variant="outlined"
            @click="signOut"
          >
            Sign out
          </v-btn>
        </div>
      </section>
    </div>
  </AppShell>
</template>
