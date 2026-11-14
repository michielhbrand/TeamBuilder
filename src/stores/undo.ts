import { ref } from 'vue'
import { defineStore } from 'pinia'

const DEFAULT_TTL_MS = 8000

export interface UndoEntry {
  id: number
  message: string
}

export const useUndoStore = defineStore('undo', () => {
  const entry = ref<UndoEntry | null>(null)
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
    action = undo
    entry.value = { id: nextId++, message }
    timer = setTimeout(clear, ttlMs)
  }

  async function run(): Promise<void> {
    const pending = action
    clear()
    await pending?.()
  }

  function reset(): void {
    clear()
  }

  return { entry, push, run, dismiss: clear, reset }
})
