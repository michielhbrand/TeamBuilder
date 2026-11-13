import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Board, Candidate } from '@/types/pipeline'

const mocks = vi.hoisted(() => ({
  fetchBoards: vi.fn<() => Promise<unknown>>(),
  updateApplicant: vi.fn<(...args: unknown[]) => unknown>(),
  uploadApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
  deleteApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
  createApplicantCvUrl: vi.fn<(...args: unknown[]) => unknown>(),
  downloadApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
  uploadBoardJobSpec: vi.fn<(...args: unknown[]) => unknown>(),
  updateBoardJobSpec: vi.fn<(...args: unknown[]) => unknown>(),
  deleteBoardJobSpec: vi.fn<(...args: unknown[]) => unknown>(),
  createBoardJobSpecUrl: vi.fn<(...args: unknown[]) => unknown>(),
  downloadBoardJobSpec: vi.fn<(...args: unknown[]) => unknown>(),
}))

vi.mock('@/lib/boards-api', () => ({
  fetchBoards: mocks.fetchBoards,
  createBoard: vi.fn<(...args: unknown[]) => unknown>(),
  updateBoard: vi.fn<(...args: unknown[]) => unknown>(),
  deleteBoard: vi.fn<(...args: unknown[]) => unknown>(),
  addBoardColumn: vi.fn<(...args: unknown[]) => unknown>(),
  renameBoardColumn: vi.fn<(...args: unknown[]) => unknown>(),
  deleteBoardColumn: vi.fn<(...args: unknown[]) => unknown>(),
  reorderBoardColumns: vi.fn<(...args: unknown[]) => unknown>(),
}))
vi.mock('@/lib/applicants-api', () => ({
  createApplicant: vi.fn<(...args: unknown[]) => unknown>(),
  updateApplicant: mocks.updateApplicant,
  deleteApplicant: vi.fn<(...args: unknown[]) => unknown>(),
}))
vi.mock('@/lib/activity-api', () => ({}))
vi.mock('@/lib/storage-api', () => ({
  uploadApplicantCv: mocks.uploadApplicantCv,
  deleteApplicantCv: mocks.deleteApplicantCv,
  createApplicantCvUrl: mocks.createApplicantCvUrl,
  downloadApplicantCv: mocks.downloadApplicantCv,
  uploadBoardJobSpec: mocks.uploadBoardJobSpec,
  updateBoardJobSpec: mocks.updateBoardJobSpec,
  deleteBoardJobSpec: mocks.deleteBoardJobSpec,
  createBoardJobSpecUrl: mocks.createBoardJobSpecUrl,
  downloadBoardJobSpec: mocks.downloadBoardJobSpec,
}))

import { useApplicantsStore } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import { useStorageStore } from '@/stores/storage'

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

async function initializedStores() {
  const boards = useBoardsStore()
  await boards.initialize()
  const applicants = useApplicantsStore()
  const storage = useStorageStore()
  return { boards, applicants, storage }
}

describe('storage store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.fetchBoards.mockResolvedValue([makeBoard()])
    mocks.updateApplicant.mockResolvedValue(undefined)
    mocks.uploadApplicantCv.mockResolvedValue({ path: 'c1/cv.pdf', name: 'cv.pdf' })
    mocks.deleteApplicantCv.mockResolvedValue(undefined)
    mocks.createApplicantCvUrl.mockResolvedValue('https://example.com/cv.pdf')
    mocks.downloadApplicantCv.mockResolvedValue(new Blob(['cv']))
    mocks.uploadBoardJobSpec.mockResolvedValue({
      path: 'b1/job-spec.pdf',
      name: 'Role.pdf',
    })
    mocks.updateBoardJobSpec.mockResolvedValue(undefined)
    mocks.deleteBoardJobSpec.mockResolvedValue(undefined)
    mocks.createBoardJobSpecUrl.mockResolvedValue('https://example.com/job-spec.pdf')
    mocks.downloadBoardJobSpec.mockResolvedValue(new Blob(['spec']))
  })

  it('uploads and removes a board job spec', async () => {
    const { boards, storage } = await initializedStores()
    const board = boards.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const uploaded = await storage.uploadJobSpec(
      board.id,
      new File(['pdf'], 'Role.pdf', { type: 'application/pdf' }),
    )

    expect(uploaded).toBe(true)
    expect(mocks.uploadBoardJobSpec).toHaveBeenCalledWith(board.id, expect.any(File))
    expect(mocks.updateBoardJobSpec).toHaveBeenCalledWith(board.id, 'b1/job-spec.pdf', 'Role.pdf')
    expect(board.jobSpecPath).toBe('b1/job-spec.pdf')
    expect(board.jobSpecName).toBe('Role.pdf')

    const removed = await storage.removeJobSpec(board.id)

    expect(removed).toBe(true)
    expect(mocks.deleteBoardJobSpec).toHaveBeenCalledWith('b1/job-spec.pdf')
    expect(mocks.updateBoardJobSpec).toHaveBeenLastCalledWith(board.id, null, null)
    expect(board.jobSpecPath).toBeNull()
  })

  it('uploads a CV and updates the applicant reference', async () => {
    const { applicants, storage } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    const uploaded = await storage.uploadCv(
      candidate.id,
      new File(['pdf'], 'cv.pdf', { type: 'application/pdf' }),
    )

    expect(uploaded).toBe(true)
    expect(mocks.uploadApplicantCv).toHaveBeenCalledWith(candidate.id, expect.any(File))
    expect(mocks.updateApplicant).toHaveBeenCalledWith(candidate.id, {
      cvPath: 'c1/cv.pdf',
      cvName: 'cv.pdf',
    })
    expect(candidate.cvPath).toBe('c1/cv.pdf')
    expect(candidate.cvName).toBe('cv.pdf')
  })

  it('removes a CV and clears the applicant reference', async () => {
    mocks.fetchBoards.mockResolvedValue([
      makeBoard({ candidates: [makeCandidate({ cvPath: 'c1/cv.pdf', cvName: 'cv.pdf' })] }),
    ])
    const { applicants, storage } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    const removed = await storage.removeCv(candidate.id)

    expect(removed).toBe(true)
    expect(mocks.deleteApplicantCv).toHaveBeenCalledWith('c1/cv.pdf')
    expect(mocks.updateApplicant).toHaveBeenCalledWith(candidate.id, {
      cvPath: null,
      cvName: null,
    })
    expect(candidate.cvPath).toBeNull()
    expect(candidate.cvName).toBeNull()
  })

  it('keeps storage errors separate from board errors', async () => {
    const { boards, storage } = await initializedStores()
    const board = boards.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    mocks.uploadBoardJobSpec.mockRejectedValue(new Error('upload failed'))
    await storage.uploadJobSpec(
      board.id,
      new File(['pdf'], 'Role.pdf', { type: 'application/pdf' }),
    )
    await boards.deleteColumn(board.id, 's1')

    expect(storage.error).toBe('upload failed')
    expect(boards.error).toBe('The first column cannot be deleted.')
  })
})
