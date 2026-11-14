import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import ColumnDialog from '@/components/ColumnDialog.vue'
import { useBoardsStore } from '@/stores/boards'
import type { Board } from '@/types/pipeline'

const board: Board = {
  id: 'b1',
  name: 'Role',
  department: 'Engineering',
  openPositions: 1,
  deadline: '2026-12-01',
  steps: ['Applied', 'Screening', 'Interview', 'Offer'].map((name, position) => ({
    id: name.toLowerCase(),
    name,
    position,
  })),
  candidates: [],
}

function mountDialog() {
  return mount(ColumnDialog, {
    props: { modelValue: true, board },
    global: { plugins: [createVuetify()] },
    attachTo: document.body,
  })
}

function handle(id: string): HTMLElement {
  return document.getElementById(`stage-handle-${id}`) as HTMLElement
}

function press(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('ColumnDialog keyboard reorder', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('visualViewport', {
      width: 1024,
      height: 768,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('moves a picked-up stage with the arrow keys and announces it', async () => {
    const store = useBoardsStore()
    const reorder = vi.spyOn(store, 'reorderColumns').mockResolvedValue(true)
    mountDialog()
    await flushPromises()

    expect(document.getElementById('stage-handle-applied')).toBeNull()

    const el = handle('interview')
    press(el, 'ArrowUp')
    await flushPromises()
    expect(reorder).not.toHaveBeenCalled()

    press(el, ' ')
    press(el, 'ArrowUp')
    await flushPromises()

    expect(reorder).toHaveBeenCalledWith('b1', ['applied', 'interview', 'screening', 'offer'])
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Moved Interview to position 2 of 4',
    )
  })

  it('never moves a stage above position 2 and keeps the order on failure', async () => {
    const store = useBoardsStore()
    const reorder = vi.spyOn(store, 'reorderColumns').mockResolvedValue(false)
    mountDialog()
    await flushPromises()

    const top = handle('screening')
    press(top, ' ')
    press(top, 'ArrowUp')
    await flushPromises()
    expect(reorder).not.toHaveBeenCalled()

    press(top, 'ArrowDown')
    await flushPromises()
    expect(reorder).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[aria-live="polite"]')?.textContent).not.toContain('Moved')
  })
})
