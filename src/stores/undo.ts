import { ref } from 'vue'
import { defineStore } from 'pinia'
import { errorMessage } from '@/lib/store-errors'

const DEFAULT_TTL_MS = 8000

export interface UndoEntry {
  id: number
  message: string
}

export const useUndoStore = defineStore('undo', () => {
  const entry = ref<UndoEntry | null>(null)
  const error = ref<string | null>(null)
  let action: (() => Promise<void>) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let nextId = 1

  function clear(): void {
    clearTimeout(timer)
    timer = undefined
    action = null
    entry.value = null
  }

  function push(message: string, undo: () => Promise<void>, ttlMs = DEFAULT_TTL_MS): void {
    clear()
    error.value = null
    action = undo
    entry.value = { id: nextId++, message }
    timer = setTimeout(clear, ttlMs)
  }

  async function run(): Promise<void> {
    const pending = action
    clear()
    error.value = null

    try {
      await pending?.()
    } catch (caught) {
      error.value = errorMessage(caught)
    }
  }

  function reset(): void {
    clear()
    error.value = null
  }

  return { entry, error, push, run, dismiss: clear, reset }
})
