import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import ColumnDialog from '@/components/ColumnDialog.vue'
import { useBoardsStore } from '@/stores/boards'
import type { Board } from '@/types/pipeline'

function makeBoard(): Board {
  return reactive(boardData()) as Board
}

const boardData = (): Board => ({
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
  candidates: [
    ['interview', 'active'],
    ['interview', 'hired'],
    ['screening', 'rejected'],
  ].map(([stepId, status], i) => ({
    id: `c${i}`,
    boardId: 'b1',
    name: `Applicant ${i}`,
    email: '',
    phone: '',
    currentRole: '',
    favorite: false,
    stepId,
    status,
    appliedAt: '2026-01-01T00:00:00.000Z',
    stepEnteredAt: '2026-01-01T00:00:00.000Z',
    education: [],
    experience: [],
  })) as Board['candidates'],
})

function mountDialog(board: Board = makeBoard()) {
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

  function rowNames(): string[] {
    return Array.from(document.querySelectorAll<HTMLInputElement>('.column-manage__row input')).map(
      (input) => input.value,
    )
  }

  function type(index: number, value: string): void {
    const input = document.querySelectorAll<HTMLInputElement>('.column-manage__row input')[index]!
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function dragEvent(type: string, target: Element): void {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, {
      dataTransfer: { setData: () => {}, setDragImage: () => {}, effectAllowed: '' },
    })
    target.dispatchEvent(event)
  }

  function rows(): Element[] {
    return Array.from(document.querySelectorAll('.column-manage__row'))
  }

  it('shows the rendered order unchanged and the store error when a reorder fails', async () => {
    const store = useBoardsStore()
    vi.spyOn(store, 'reorderColumns').mockImplementation(async () => {
      store.error = 'Could not save the order.'
      return false
    })
    mountDialog()
    await flushPromises()

    const el = handle('interview')
    press(el, ' ')
    press(el, 'ArrowUp')
    await flushPromises()

    expect(rowNames()).toEqual(['Applied', 'Screening', 'Interview', 'Offer'])
    expect(document.querySelector('.v-alert')?.textContent).toContain('Could not save the order.')
  })

  it('keeps an unsaved rename in another row when reordering and adding', async () => {
    const store = useBoardsStore()
    const rename = vi
      .spyOn(store, 'renameColumn')
      .mockImplementation(async (_boardId, stepId, name) => {
        const step = b.steps.find((item) => item.id === stepId)!
        step.name = name
        return true
      })
    vi.spyOn(store, 'reorderColumns').mockImplementation(async (_boardId, ids) => {
      b.steps = ids.map((id) => b.steps.find((item) => item.id === id)!)
      return true
    })
    const addColumn = vi.spyOn(store, 'addColumn').mockResolvedValue(true)
    const b = makeBoard()
    mountDialog(b)
    await flushPromises()

    type(3, 'Final offer')
    const el = handle('screening')
    press(el, ' ')
    press(el, 'ArrowDown')
    await flushPromises()

    expect(rename).toHaveBeenCalledWith('b1', 'offer', 'Final offer')
    expect(rowNames()).toEqual(['Applied', 'Interview', 'Screening', 'Final offer'])

    type(1, 'Panel')
    const input = document.querySelector<HTMLInputElement>('.column-manage__add input')!
    input.value = 'Reference check'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()

    expect(addColumn).toHaveBeenCalledWith('b1', 'Reference check')
    expect(rename).toHaveBeenCalledWith('b1', 'interview', 'Panel')
    expect(rowNames()).toEqual(['Applied', 'Panel', 'Screening', 'Final offer'])
  })

  it('aborts reorder, add and delete when a flushed rename fails and keeps the draft and error', async () => {
    const store = useBoardsStore()
    vi.spyOn(store, 'renameColumn').mockImplementation(async () => {
      store.error = 'Could not rename the stage.'
      return false
    })
    const reorder = vi.spyOn(store, 'reorderColumns').mockResolvedValue(true)
    const addColumn = vi.spyOn(store, 'addColumn').mockResolvedValue(true)
    const remove = vi.spyOn(store, 'deleteColumn').mockResolvedValue(true)
    mountDialog()
    await flushPromises()

    type(3, 'Final offer')
    const el = handle('screening')
    press(el, ' ')
    press(el, 'ArrowDown')
    await flushPromises()
    expect(reorder).not.toHaveBeenCalled()

    const input = document.querySelector<HTMLInputElement>('.column-manage__add input')!
    input.value = 'Reference check'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(addColumn).not.toHaveBeenCalled()

    document.querySelector<HTMLElement>('[aria-label="Delete Interview"]')!.click()
    await flushPromises()
    Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find((button) => button.textContent?.trim() === 'Delete stage')!
      .click()
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()

    expect(rowNames()[3]).toBe('Final offer')
    expect(document.querySelector('.v-alert')?.textContent).toContain('Could not rename the stage.')
  })

  it('ignores add while a reorder is in flight', async () => {
    const store = useBoardsStore()
    let release: (value: boolean) => void = () => {}
    vi.spyOn(store, 'reorderColumns').mockImplementation(
      () => new Promise<boolean>((resolve) => (release = resolve)),
    )
    const addColumn = vi.spyOn(store, 'addColumn').mockResolvedValue(true)
    mountDialog()
    await flushPromises()

    const el = handle('interview')
    press(el, ' ')
    press(el, 'ArrowUp')
    await flushPromises()

    const input = document.querySelector<HTMLInputElement>('.column-manage__add input')!
    input.value = 'Reference check'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(addColumn).not.toHaveBeenCalled()

    release(true)
    await flushPromises()
  })

  it('rejects a drop on the first row, ignores a drop on itself, and clears drop state on dragend', async () => {
    const store = useBoardsStore()
    const reorder = vi.spyOn(store, 'reorderColumns').mockResolvedValue(true)
    mountDialog()
    await flushPromises()

    const source = handle('interview')
    dragEvent('dragstart', source)
    dragEvent('dragover', rows()[0]!)
    expect(document.querySelector('.is-drop')).toBeNull()
    dragEvent('drop', rows()[0]!)
    await flushPromises()
    expect(reorder).not.toHaveBeenCalled()

    dragEvent('dragstart', source)
    dragEvent('drop', rows()[2]!)
    await flushPromises()
    expect(reorder).not.toHaveBeenCalled()

    dragEvent('dragstart', source)
    dragEvent('dragover', rows()[1]!)
    await flushPromises()
    expect(rows()[1]!.classList.contains('is-drop')).toBe(true)
    expect(rows()[2]!.classList.contains('is-dragging')).toBe(true)
    dragEvent('dragend', source)
    await flushPromises()
    expect(document.querySelector('.is-drop')).toBeNull()
    expect(document.querySelector('.is-dragging')).toBeNull()

    dragEvent('dragstart', source)
    dragEvent('drop', rows()[1]!)
    await flushPromises()
    expect(reorder).toHaveBeenCalledWith('b1', ['applied', 'interview', 'screening', 'offer'])
  })

  it('confirms a delete with the applicant count across all statuses', async () => {
    const store = useBoardsStore()
    const remove = vi.spyOn(store, 'deleteColumn').mockResolvedValue(true)
    mountDialog()
    await flushPromises()

    document.querySelector<HTMLElement>('[aria-label="Delete Interview"]')!.click()
    await flushPromises()

    expect(document.querySelector('.confirm-dialog__message')?.textContent).toBe(
      '2 applicants will move to Applied.',
    )
    expect(remove).not.toHaveBeenCalled()

    const confirm = Array.from(document.querySelectorAll<HTMLElement>('button')).find(
      (button) => button.textContent?.trim() === 'Delete stage',
    )!
    confirm.click()
    await flushPromises()

    expect(remove).toHaveBeenCalledWith('b1', 'interview')
  })

  it('renders a lock and Default chip on the first row and no handle or delete there', async () => {
    mountDialog()
    await flushPromises()

    const first = rows()[0]!
    expect(first.querySelector('.mdi-lock-outline')).not.toBeNull()
    expect(first.textContent).toContain('Default')
    expect(first.querySelector('button')).toBeNull()
    expect(rows()[1]!.querySelector('[aria-label="Delete Screening"]')).not.toBeNull()
  })

  it('renders no handles or delete buttons for a single-stage board', async () => {
    const b = makeBoard()
    b.steps = [b.steps[0]!]
    mountDialog(b)
    await flushPromises()

    expect(rows()).toHaveLength(1)
    expect(document.querySelector('.column-manage__grip:not(.is-locked)')).toBeNull()
    expect(document.querySelector('.column-manage__delete')).toBeNull()
  })

  it('debounces a rename by 700ms and flushes a pending one when the dialog closes', async () => {
    vi.useFakeTimers()
    const store = useBoardsStore()
    const rename = vi.spyOn(store, 'renameColumn').mockResolvedValue(true)
    const wrapper = mountDialog()
    await flushPromises()

    type(1, 'Phone screen')
    vi.advanceTimersByTime(699)
    expect(rename).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(rename).toHaveBeenCalledWith('b1', 'screening', 'Phone screen')

    type(2, 'Panel')
    await wrapper.setProps({ modelValue: false })
    expect(rename).toHaveBeenCalledWith('b1', 'interview', 'Panel')
    vi.useRealTimers()
  })
})
