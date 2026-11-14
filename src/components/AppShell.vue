<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '@/components/BrandMark.vue'
import FullNameDialog from '@/components/FullNameDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import UndoToast from '@/components/UndoToast.vue'
import { useAuthStore } from '@/stores/auth'
import { useBoardsStore } from '@/stores/boards'

const auth = useAuthStore()
const boards = useBoardsStore()

const email = computed(() => auth.user?.email ?? 'Signed in')

const initials = computed(() => {
  const localPart = (auth.user?.email ?? 'teambuilder').split('@')[0] ?? 'teambuilder'
  const parts = localPart.split(/[._-]+/).filter(Boolean)
  const first = parts[0] ?? 'T'
  const second = parts[1] ?? first.charAt(1) ?? 'B'

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
})

function refreshWorkspace(): void {
  void boards.refresh()
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    refreshWorkspace()
  }
}

async function signOut(): Promise<void> {
  await auth.signOut()
}

onMounted(() => {
  window.addEventListener('focus', refreshWorkspace)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshWorkspace)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="orbital-page app-shell">
    <header class="app-topbar">
      <BrandMark />

      <nav class="app-nav" aria-label="Workspace">
        <RouterLink class="app-nav-link" active-class="app-nav-link--active" to="/overview">
          Overview
        </RouterLink>
        <RouterLink class="app-nav-link" active-class="app-nav-link--active" to="/boards">
          Boards
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

    <FullNameDialog />
    <UndoToast />
  </div>
</template>
