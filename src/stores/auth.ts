import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { DEFAULT_ACTOR_NAME } from '@/lib/applicant-events'
import { supabase } from '@/lib/supabase'
import {
  initialAuthLinkError,
  initialAuthLinkType,
  initialAuthTokenHash,
  type AuthLinkType,
} from '@/lib/auth-link'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useApplicantsStore } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import { useFitStore } from '@/stores/fit'
import { useStorageStore } from '@/stores/storage'

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Something went wrong. Please try again.'
}

function friendlyErrorMessage(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Invalid email or password.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'This account has not been confirmed yet. Confirm it in Supabase first.'
  }

  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Could not reach Supabase. Check your connection and environment values.'
  }

  if (normalized.includes('password should be at least')) {
    return 'Password must be at least 8 characters.'
  }

  if (normalized.includes('should be different')) {
    return 'Choose a password different from your current one.'
  }

  if (
    normalized.includes('link is invalid') ||
    normalized.includes('token has expired') ||
    normalized.includes('invalid or expired')
  ) {
    return 'This link is invalid or has expired. Ask for a new invitation.'
  }

  return message
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const linkError = ref<string | null>(initialAuthLinkError)
  const linkType = ref<AuthLinkType>(initialAuthLinkType)
  const linkTokenHash = ref<string | null>(initialAuthTokenHash)
  const passwordSetupRequired = ref(initialAuthLinkType !== null)
  const user = computed<User | null>(() => session.value?.user ?? null)
  const isAuthenticated = computed(() => session.value !== null)
  const fullName = computed(() => {
    const value = user.value?.user_metadata?.full_name
    return typeof value === 'string' ? value.trim() : ''
  })
  const fullNameRequired = computed(() => isAuthenticated.value && !fullName.value)
  const actorName = computed(() => fullName.value || user.value?.email || DEFAULT_ACTOR_NAME)
  let unsubscribe: (() => void) | undefined

  function resetWorkspace(): void {
    useBoardsStore().reset()
    useApplicantsStore().reset()
    useApplicantActivityStore().reset()
    useStorageStore().reset()
    useFitStore().reset()
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw sessionError
      }

      session.value = data.session

      if (!unsubscribe) {
        const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
          session.value = nextSession

          if (!nextSession) {
            resetWorkspace()
          }

          if (event === 'PASSWORD_RECOVERY') {
            passwordSetupRequired.value = true
          }
        })
        unsubscribe = () => listener.subscription.unsubscribe()
      }
    } catch (caught) {
      error.value = friendlyErrorMessage(errorMessage(caught))
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw signInError
      }

      session.value = data.session
      return true
    } catch (caught) {
      error.value = friendlyErrorMessage(errorMessage(caught))
      return false
    } finally {
      loading.value = false
    }
  }

  async function verifyLink(): Promise<boolean> {
    const tokenHash = linkTokenHash.value
    const type = linkType.value

    if (!tokenHash || !type) {
      return false
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })

      if (verifyError) {
        throw verifyError
      }

      session.value = data.session
      passwordSetupRequired.value = true
      linkTokenHash.value = null
      linkError.value = null
      return true
    } catch (caught) {
      error.value = friendlyErrorMessage(errorMessage(caught))
      return false
    } finally {
      loading.value = false
    }
  }

  async function setPassword(password: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        throw updateError
      }

      passwordSetupRequired.value = false
      linkError.value = null
      return true
    } catch (caught) {
      error.value = friendlyErrorMessage(errorMessage(caught))
      return false
    } finally {
      loading.value = false
    }
  }

  async function updateFullName(name: string): Promise<boolean> {
    const trimmed = name.trim()

    if (!trimmed) {
      error.value = 'Enter your full name.'
      return false
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      })

      if (updateError) {
        throw updateError
      }

      if (session.value && data.user) {
        session.value = { ...session.value, user: data.user }
      }

      return true
    } catch (caught) {
      error.value = friendlyErrorMessage(errorMessage(caught))
      return false
    } finally {
      loading.value = false
    }
  }

  async function signOut(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        throw signOutError
      }

      session.value = null
      passwordSetupRequired.value = false
      resetWorkspace()
    } catch (caught) {
      error.value = friendlyErrorMessage(errorMessage(caught))
    } finally {
      loading.value = false
    }
  }

  return {
    session,
    initialized,
    loading,
    error,
    linkError,
    linkType,
    linkTokenHash,
    passwordSetupRequired,
    user,
    isAuthenticated,
    fullName,
    fullNameRequired,
    actorName,
    initialize,
    signIn,
    verifyLink,
    setPassword,
    updateFullName,
    signOut,
  }
})
