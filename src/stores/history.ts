import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/lib/history-api'
import { errorMessage } from '@/lib/store-errors'
import type { HireRecord, HiringMonth } from '@/types/history'

export const useHistoryStore = defineStore('history', () => {
  const months = ref<HiringMonth[]>([])
  const hires = ref<HireRecord[]>([])
  const loading = ref(false)
  const refreshing = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)

  async function initialize(): Promise<void> {
    if (initialized.value || loading.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const [nextMonths, nextHires] = await Promise.all([
        api.fetchHiringMonthly(),
        api.fetchHireHistory(),
      ])
      months.value = nextMonths
      hires.value = nextHires
      initialized.value = true
    } catch (caught) {
      error.value = errorMessage(caught)
    } finally {
      loading.value = false
    }
  }

  async function refresh(): Promise<void> {
    if (!initialized.value || refreshing.value) {
      return
    }

    refreshing.value = true

    try {
      const [nextMonths, nextHires] = await Promise.all([
        api.fetchHiringMonthly(),
        api.fetchHireHistory(),
      ])
      months.value = nextMonths
      hires.value = nextHires
      error.value = null
    } catch (caught) {
      error.value = errorMessage(caught)
    } finally {
      refreshing.value = false
    }
  }

  function reset(): void {
    months.value = []
    hires.value = []
    loading.value = false
    refreshing.value = false
    initialized.value = false
    error.value = null
  }

  return { months, hires, loading, initialized, error, initialize, refresh, reset }
})
