import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUndoStore } from '@/stores/undo'

describe('undo store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('push exposes the entry', () => {
    const undo = useUndoStore()

    undo.push('Amara hired', vi.fn<() => Promise<void>>())

    expect(undo.entry?.message).toBe('Amara hired')
  })

  it('a second push replaces the first and cancels its timer', () => {
    const undo = useUndoStore()

    undo.push('first', vi.fn<() => Promise<void>>())
    const firstId = undo.entry?.id
    undo.push('second', vi.fn<() => Promise<void>>())

    expect(undo.entry?.message).toBe('second')
    expect(undo.entry?.id).not.toBe(firstId)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('entry clears after the ttl', () => {
    const undo = useUndoStore()

    undo.push('Amara hired', vi.fn<() => Promise<void>>())
    vi.advanceTimersByTime(7999)
    expect(undo.entry).not.toBeNull()
    vi.advanceTimersByTime(1)

    expect(undo.entry).toBeNull()
  })

  it('run calls the undo once and clears', async () => {
    const undo = useUndoStore()
    const action = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    undo.push('Amara hired', action)
    await undo.run()
    await undo.run()

    expect(action).toHaveBeenCalledOnce()
    expect(undo.entry).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('run does nothing when there is no entry', async () => {
    const undo = useUndoStore()

    await expect(undo.run()).resolves.toBeUndefined()
    expect(undo.entry).toBeNull()
  })

  it('dismiss and reset clear the entry and timer', () => {
    const undo = useUndoStore()

    undo.push('one', vi.fn<() => Promise<void>>())
    undo.dismiss()
    expect(undo.entry).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    undo.push('two', vi.fn<() => Promise<void>>())
    undo.reset()
    expect(undo.entry).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})
