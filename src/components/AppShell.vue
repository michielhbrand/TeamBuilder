<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BrandMark from '@/components/BrandMark.vue'
import FullNameDialog from '@/components/FullNameDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useApplicantsStore } from '@/stores/applicants'
import { useAuthStore } from '@/stores/auth'
import { useBoardsStore } from '@/stores/boards'
import { useFitStore } from '@/stores/fit'
import { useStorageStore } from '@/stores/storage'

const auth = useAuthStore()
const boards = useBoardsStore()
const applicants = useApplicantsStore()
const activity = useApplicantActivityStore()
const storage = useStorageStore()
const fit = useFitStore()
const router = useRouter()

const email = computed(() => auth.user?.email ?? 'Signed in')

const initials = computed(() => {
  const localPart = (auth.user?.email ?? 'teambuilder').split('@')[0] ?? 'teambuilder'
  const parts = localPart.split(/[._-]+/).filter(Boolean)
  const first = parts[0] ?? 'T'
  const second = parts[1] ?? first.charAt(1) ?? 'B'

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
})

async function signOut(): Promise<void> {
  await auth.signOut()
  boards.reset()
  applicants.reset()
  activity.reset()
  storage.reset()
  fit.reset()
  await router.replace('/')
}
</script>

<template>
  <div class="orbital-page app-shell">
    <div class="orbital-orbit orbital-orbit--a" aria-hidden="true" />
    <div class="orbital-orbit orbital-orbit--b" aria-hidden="true" />

    <header class="app-topbar">
      <BrandMark context="Recruitment platform" />

      <nav class="app-nav" aria-label="Workspace">
        <RouterLink class="app-nav-link" active-class="app-nav-link--active" to="/overview">
          Overview
        </RouterLink>
        <RouterLink class="app-nav-link" active-class="app-nav-link--active" to="/boards">
          Boards
        </RouterLink>
        <RouterLink class="app-nav-link" active-class="app-nav-link--active" to="/account">
          Account
        </RouterLink>
      </nav>

      <div class="topbar-actions">
        <ThemeToggle />
        <v-menu location="bottom end">
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              class="user-avatar app-avatar"
              type="button"
              :aria-label="`Account menu for ${email}`"
            >
              {{ initials }}
            </button>
          </template>
          <v-list class="app-menu" density="compact" lines="two">
            <v-list-item :subtitle="email" title="Signed in" />
            <v-divider />
            <v-list-item prepend-icon="mdi-account-circle-outline" title="Account" to="/account" />
            <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="signOut" />
          </v-list>
        </v-menu>
      </div>
    </header>

    <main class="app-main">
      <slot />
    </main>

    <footer class="page-footer">
      <span>TeamBuilder / Vue 3 + Supabase</span>
      <span>Orbital system / A</span>
    </footer>

    <FullNameDialog />
  </div>
</template>
