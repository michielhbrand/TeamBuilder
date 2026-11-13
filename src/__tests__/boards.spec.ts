import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Board, Candidate } from '@/types/pipeline'

const mocks = vi.hoisted(() => ({
  fetchBoards: vi.fn<() => Promise<unknown>>(),
  createBoard: vi.fn<(...args: unknown[]) => unknown>(),
  updateBoard: vi.fn<(...args: unknown[]) => unknown>(),
  deleteBoard: vi.fn<(...args: unknown[]) => unknown>(),
  addBoardColumn: vi.fn<(...args: unknown[]) => unknown>(),
  renameBoardColumn: vi.fn<(...args: unknown[]) => unknown>(),
  deleteBoardColumn: vi.fn<(...args: unknown[]) => unknown>(),
  reorderBoardColumns: vi.fn<(...args: unknown[]) => unknown>(),
  deleteApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
  deleteBoardJobSpec: vi.fn<(...args: unknown[]) => unknown>(),
}))

vi.mock('@/lib/boards-api', () => mocks)
vi.mock('@/lib/applicants-api', () => ({}))
vi.mock('@/lib/activity-api', () => ({}))
vi.mock('@/lib/storage-api', () => ({
  deleteApplicantCv: mocks.deleteApplicantCv,
  deleteBoardJobSpec: mocks.deleteBoardJobSpec,
}))

import { useBoardsStore } from '@/stores/boards'

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    boardId: 'b1',
    name: 'Amara Okafor',
    email: 'amara@example.com',
    phone: '+1 555 010 2000',
    currentRole: 'Product Designer',
    favorite: false,
    stepId: 's1',
    status: 'active',
    appliedAt: '2026-11-01T00:00:00Z',
    stepEnteredAt: '2026-11-03T00:00:00Z',
    education: '',
    experience: '',
    ...overrides,
  }
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'b1',
    name: 'Frontend Engineer',
    department: 'Engineering',
    openPositions: 1,
    deadline: '2026-12-31',
    steps: [
      { id: 's1', name: 'Applied', position: 0 },
      { id: 's2', name: 'Interview', position: 1 },
    ],
    candidates: [makeCandidate()],
    ...overrides,
  }
}

async function initializedStore() {
  const store = useBoardsStore()
  await store.initialize()
  return store
}

describe('boards store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.fetchBoards.mockResolvedValue([makeBoard()])
    mocks.deleteBoard.mockResolvedValue(undefined)
    mocks.deleteBoardColumn.mockResolvedValue(undefined)
    mocks.reorderBoardColumns.mockResolvedValue(undefined)
    mocks.renameBoardColumn.mockResolvedValue(undefined)
    mocks.deleteApplicantCv.mockResolvedValue(undefined)
    mocks.deleteBoardJobSpec.mockResolvedValue(undefined)
  })

  it('loads boards from the backend once', async () => {
    const store = useBoardsStore()

    await store.initialize()
    await store.initialize()

    expect(mocks.fetchBoards).toHaveBeenCalledOnce()
    expect(store.initialized).toBe(true)
    expect(store.boards).toHaveLength(1)
  })

  it('moves applicants to the first column when a later column is deleted', async () => {
    const store = await initializedStore()
    const board = store.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const first = board.steps[0]
    const candidate = board.candidates[0]

    expect(first).toBeDefined()
    expect(candidate).toBeDefined()
    if (!first || !candidate) return

    candidate.stepId = 's2'

    const deleted = await store.deleteColumn(board.id, 's2')

    expect(deleted).toBe(true)
    expect(mocks.deleteBoardColumn).toHaveBeenCalledWith('s2')
    expect(candidate.stepId).toBe(first.id)
    expect(board.steps.map((step) => step.id)).toEqual(['s1'])
  })

  it('refuses to delete the first column', async () => {
    const store = await initializedStore()
    const board = store.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const deleted = await store.deleteColumn(board.id, 's1')

    expect(deleted).toBe(false)
    expect(mocks.deleteBoardColumn).not.toHaveBeenCalled()
    expect(store.error).toBe('The first column cannot be deleted.')
  })

  it('reorders columns while keeping the first column fixed', async () => {
    mocks.fetchBoards.mockResolvedValue([
      makeBoard({
        steps: [
          { id: 's1', name: 'Applied', position: 0 },
          { id: 's2', name: 'Interview', position: 1 },
          { id: 's3', name: 'Offer', position: 2 },
        ],
      }),
    ])
    const store = await initializedStore()
    const board = store.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const reordered = await store.reorderColumns(board.id, ['s1', 's3', 's2'])

    expect(reordered).toBe(true)
    expect(mocks.reorderBoardColumns).toHaveBeenCalledExactlyOnceWith(board.id, ['s1', 's3', 's2'])
    expect(board.steps.map((step) => step.name)).toEqual(['Applied', 'Offer', 'Interview'])
    expect(board.steps.map((step) => step.position)).toEqual([0, 1, 2])

    const rejected = await store.reorderColumns(board.id, ['s2', 's1', 's3'])

    expect(rejected).toBe(false)
    expect(mocks.reorderBoardColumns).toHaveBeenCalledOnce()
    expect(store.error).toBe('The first column must stay first.')
  })

  it('deletes a board and removes it from state', async () => {
    const store = await initializedStore()
    const board = store.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const deleted = await store.deleteBoard(board.id)

    expect(deleted).toBe(true)
    expect(mocks.deleteBoard).toHaveBeenCalledExactlyOnceWith(board.id)
    expect(store.boards).toEqual([])
  })

  it('removes applicant CVs and the job spec object when deleting a board', async () => {
    mocks.fetchBoards.mockResolvedValue([
      makeBoard({
        jobSpecPath: 'b1/job-spec.pdf',
        candidates: [makeCandidate({ cvPath: 'c1/cv.pdf' })],
      }),
    ])
    const store = await initializedStore()
    const board = store.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const deleted = await store.deleteBoard(board.id)

    expect(deleted).toBe(true)
    expect(mocks.deleteApplicantCv).toHaveBeenCalledWith('c1/cv.pdf')
    expect(mocks.deleteBoardJobSpec).toHaveBeenCalledWith('b1/job-spec.pdf')
  })

  it('adds a new column at the end of the board', async () => {
    const store = await initializedStore()
    const board = store.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    mocks.addBoardColumn.mockResolvedValue({ id: 's3', name: 'Offer' })

    const added = await store.addColumn(board.id, 'Offer')

    expect(added).toBe(true)
    expect(mocks.addBoardColumn).toHaveBeenCalledWith(board.id, 'Offer')
    expect(board.steps[board.steps.length - 1]).toEqual({
      id: 's3',
      name: 'Offer',
      position: 2,
    })
  })

  it('derives past-deadline boards and totals', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    mocks.fetchBoards.mockResolvedValue([
      makeBoard({ id: 'b1', deadline: yesterday }),
      makeBoard({ id: 'b2', name: 'Backend Engineer', deadline: '2099-01-01' }),
    ])
    const store = await initializedStore()

    expect(store.summaries).toHaveLength(2)
    expect(store.totals.overdue).toBe(1)
    expect(store.needsAttention.map((summary) => summary.board.id)).toEqual(['b1'])
  })

  it('resets loaded data', async () => {
    const store = await initializedStore()

    store.reset()

    expect(store.boards).toEqual([])
    expect(store.initialized).toBe(false)
    expect(store.error).toBeNull()
  })
})
