import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createCareerEntry } from '@/lib/career'
import type { Board, Candidate } from '@/types/pipeline'

const mocks = vi.hoisted(() => ({
  fetchBoards: vi.fn<() => Promise<unknown>>(),
  createApplicant: vi.fn<(...args: unknown[]) => unknown>(),
  updateApplicant: vi.fn<(...args: unknown[]) => unknown>(),
  deleteApplicant: vi.fn<(...args: unknown[]) => unknown>(),
  recordApplicantEditEvent: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchApplicantEvents: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  uploadApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
  deleteApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
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
  createApplicant: mocks.createApplicant,
  updateApplicant: mocks.updateApplicant,
  deleteApplicant: mocks.deleteApplicant,
}))
vi.mock('@/lib/activity-api', () => ({
  recordApplicantEditEvent: mocks.recordApplicantEditEvent,
  fetchApplicantEvents: mocks.fetchApplicantEvents,
}))
vi.mock('@/lib/storage-api', () => ({
  uploadApplicantCv: mocks.uploadApplicantCv,
  deleteApplicantCv: mocks.deleteApplicantCv,
}))

import { useApplicantsStore } from '@/stores/applicants'
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
    education: [],
    experience: [],
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
  return { boards, applicants }
}

describe('applicants store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.fetchBoards.mockResolvedValue([makeBoard()])
    mocks.updateApplicant.mockResolvedValue(undefined)
    mocks.deleteApplicant.mockResolvedValue(undefined)
    mocks.recordApplicantEditEvent.mockResolvedValue(undefined)
    mocks.fetchApplicantEvents.mockResolvedValue([])
    mocks.uploadApplicantCv.mockResolvedValue({ path: 'c3/cv.pdf', name: 'noor-cv.pdf' })
    mocks.deleteApplicantCv.mockResolvedValue(undefined)
  })

  it('advances a candidate and persists the new column', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    await applicants.advanceCandidate(candidate.id)

    expect(candidate.stepId).toBe('s2')
    expect(mocks.updateApplicant).toHaveBeenCalledWith(
      candidate.id,
      expect.objectContaining({ columnId: 's2', status: 'active' }),
    )
  })

  it('rejects, reopens, and hires candidates', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    applicants.rejectCandidate(candidate.id)
    expect(candidate.status).toBe('rejected')

    applicants.reopenCandidate(candidate.id)
    expect(candidate.status).toBe('active')

    applicants.hireCandidate(candidate.id)
    expect(candidate.status).toBe('hired')
    expect(mocks.updateApplicant).toHaveBeenCalledTimes(3)
  })

  it('updates profile fields locally and persists them on flush', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    applicants.updateCandidateField(candidate.id, 'email', 'new.address@example.com')
    applicants.updateCandidateField(candidate.id, 'currentRole', 'Staff Engineer')
    applicants.toggleFavorite(candidate.id)

    expect(candidate.email).toBe('new.address@example.com')
    expect(candidate.currentRole).toBe('Staff Engineer')
    expect(candidate.favorite).toBe(true)

    await applicants.flushCandidate(candidate.id)

    const [id, patch] = mocks.updateApplicant.mock.calls[0] as [string, Record<string, unknown>]

    expect(id).toBe(candidate.id)
    expect(patch).toEqual({
      email: 'new.address@example.com',
      currentRole: 'Staff Engineer',
      favorite: true,
    })
    expect(patch).not.toHaveProperty('status')
    expect(patch).not.toHaveProperty('columnId')
  })

  it('saves only fields changed since the last successful save', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    applicants.updateCandidateField(candidate.id, 'email', 'first@example.com')
    await applicants.flushCandidate(candidate.id)

    applicants.updateCandidateField(candidate.id, 'phone', '+1 555 010 9999')
    await applicants.flushCandidate(candidate.id)

    expect(mocks.updateApplicant).toHaveBeenCalledTimes(2)
    expect(mocks.updateApplicant).toHaveBeenNthCalledWith(2, candidate.id, {
      phone: '+1 555 010 9999',
    })
  })

  it('saves career entries as a changed field and records one edit event', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    const entry = createCareerEntry({
      title: 'Product Designer',
      organization: 'Acme',
      start: '2020-01',
      current: true,
    })

    applicants.beginCandidateEdit(candidate.id)
    applicants.updateCandidateEntries(candidate.id, 'experience', [entry])

    expect(candidate.experience).toEqual([entry])

    await applicants.flushCandidate(candidate.id)

    expect(mocks.updateApplicant).toHaveBeenCalledExactlyOnceWith(candidate.id, {
      experience: [entry],
    })
    expect(mocks.recordApplicantEditEvent).toHaveBeenCalledExactlyOnceWith(candidate.id)
  })

  it('keeps career entries sorted by start date', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    const older = createCareerEntry({
      id: 'older',
      title: 'Analyst',
      start: '2015-01',
      end: '2018-01',
    })
    const newer = createCareerEntry({
      id: 'newer',
      title: 'Engineer',
      start: '2020-01',
      current: true,
    })

    applicants.updateCandidateEntries(candidate.id, 'experience', [older, newer])

    expect(candidate.experience.map((entry) => entry.id)).toEqual(['newer', 'older'])
  })

  it('does not record an edit event when entries are replaced with identical content', async () => {
    const entry = createCareerEntry({ title: 'Analyst', start: '2019-03', end: '2020-03' })
    mocks.fetchBoards.mockResolvedValue([
      makeBoard({ candidates: [makeCandidate({ experience: [entry] })] }),
    ])
    const { applicants } = await initializedStores()

    applicants.beginCandidateEdit('c1')
    applicants.updateCandidateEntries('c1', 'experience', [{ ...entry }])
    await applicants.flushCandidate('c1')

    expect(mocks.recordApplicantEditEvent).not.toHaveBeenCalled()
  })

  it('records one edit event per profile session through the narrow RPC', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    applicants.beginCandidateEdit(candidate.id)
    applicants.updateCandidateField(candidate.id, 'email', 'new.address@example.com')
    applicants.updateCandidateField(candidate.id, 'currentRole', 'Staff Engineer')
    applicants.toggleFavorite(candidate.id)

    await applicants.flushCandidate(candidate.id)

    expect(mocks.recordApplicantEditEvent).toHaveBeenCalledExactlyOnceWith(candidate.id)
    expect(mocks.fetchApplicantEvents).toHaveBeenCalledWith('b1', candidate.id)
  })

  it('does not record an edit event when the profile is unchanged', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    applicants.beginCandidateEdit(candidate.id)
    await applicants.flushCandidate(candidate.id)

    expect(mocks.recordApplicantEditEvent).not.toHaveBeenCalled()
  })

  it('persists moves and leaves event recording to Postgres', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    await applicants.moveCandidate(candidate.id, 's2')

    expect(mocks.updateApplicant).toHaveBeenCalledExactlyOnceWith(
      candidate.id,
      expect.objectContaining({ columnId: 's2', status: 'active' }),
    )
    expect(mocks.recordApplicantEditEvent).not.toHaveBeenCalled()
  })

  it('does not persist a move when the step does not change', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    await applicants.moveCandidate(candidate.id, 's1')

    expect(mocks.updateApplicant).not.toHaveBeenCalled()
    expect(mocks.recordApplicantEditEvent).not.toHaveBeenCalled()
  })

  it('marks a candidate as not saved when autosave fails', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    applicants.updateCandidateField(candidate.id, 'email', 'unsaved@example.com')
    mocks.updateApplicant.mockRejectedValueOnce(new Error('Network error'))

    await applicants.flushCandidate(candidate.id)

    expect(candidate.email).toBe('unsaved@example.com')
    expect(applicants.hasUnsavedChanges(candidate.id)).toBe(true)
    expect(applicants.error).toBe('Network error')

    mocks.updateApplicant.mockResolvedValueOnce(undefined)
    await applicants.flushCandidate(candidate.id)

    expect(applicants.hasUnsavedChanges(candidate.id)).toBe(false)
    expect(applicants.error).toBeNull()
  })

  it('persists hire, reject, and reopen status changes', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    await applicants.hireCandidate(candidate.id)
    await applicants.rejectCandidate(candidate.id)
    await applicants.reopenCandidate(candidate.id)

    expect(mocks.updateApplicant).toHaveBeenNthCalledWith(1, candidate.id, { status: 'hired' })
    expect(mocks.updateApplicant).toHaveBeenNthCalledWith(2, candidate.id, { status: 'rejected' })
    expect(mocks.updateApplicant).toHaveBeenNthCalledWith(3, candidate.id, { status: 'active' })
    expect(mocks.recordApplicantEditEvent).not.toHaveBeenCalled()
  })

  it('creates and deletes applicants through the backend', async () => {
    const { boards, applicants } = await initializedStores()
    const board = boards.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const created = makeCandidate({
      id: 'c2',
      name: 'Liam Price',
      email: 'liam@example.com',
      phone: '+1 555 010 3000',
    })
    mocks.createApplicant.mockResolvedValue(created)

    const added = await applicants.createApplicant(board.id, {
      name: 'Liam Price',
      email: 'liam@example.com',
      phone: '+1 555 010 3000',
      stepId: 's2',
    })

    expect(added).toEqual(created)
    expect(mocks.createApplicant).toHaveBeenCalledWith(
      board.id,
      's2',
      expect.objectContaining({ name: 'Liam Price', email: 'liam@example.com' }),
    )
    expect(applicants.candidateById('c2')).toEqual(created)

    const removed = await applicants.deleteApplicant('c2')

    expect(removed).toBe(true)
    expect(mocks.deleteApplicant).toHaveBeenCalledWith('c2')
    expect(applicants.candidateById('c2')).toBeUndefined()
  })

  it('creates applicants without writing events from the client', async () => {
    const { boards, applicants } = await initializedStores()
    const board = boards.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const created = makeCandidate({ id: 'c4', name: 'Liam Price' })
    mocks.createApplicant.mockResolvedValue(created)

    const added = await applicants.createApplicant(board.id, {
      name: 'Liam Price',
      email: '',
      phone: '',
    })

    expect(added).toEqual(created)
    expect(mocks.recordApplicantEditEvent).not.toHaveBeenCalled()
  })

  it('uploads a CV when one is supplied at creation', async () => {
    const { boards, applicants } = await initializedStores()
    const board = boards.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    const created = makeCandidate({ id: 'c3', name: 'Noor Haddad' })
    const cv = new File([new Uint8Array([1, 2, 3])], 'noor-cv.pdf', {
      type: 'application/pdf',
    })

    mocks.createApplicant.mockResolvedValue(created)

    const added = await applicants.createApplicant(
      board.id,
      {
        name: 'Noor Haddad',
        email: '',
        phone: '',
      },
      cv,
    )

    expect(added).toEqual(created)
    expect(added?.cvPath).toBe('c3/cv.pdf')
    expect(added?.cvName).toBe('noor-cv.pdf')
    expect(mocks.uploadApplicantCv).toHaveBeenCalledWith('c3', cv)
    expect(applicants.candidateById('c3')?.cvPath).toBe('c3/cv.pdf')
    expect(applicants.candidateById('c3')?.cvName).toBe('noor-cv.pdf')
  })

  it('defaults new applicants to the Applied column', async () => {
    mocks.fetchBoards.mockResolvedValue([
      makeBoard({
        steps: [
          { id: 's1', name: 'Screening', position: 0 },
          { id: 's2', name: 'Applied', position: 1 },
        ],
      }),
    ])
    const { boards, applicants } = await initializedStores()
    const board = boards.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    mocks.createApplicant.mockResolvedValue(makeCandidate({ id: 'c2' }))

    await applicants.createApplicant(board.id, {
      name: 'Liam Price',
      email: '',
      phone: '',
    })

    expect(mocks.createApplicant).toHaveBeenCalledWith(
      board.id,
      's2',
      expect.objectContaining({ name: 'Liam Price' }),
    )
  })

  it('keeps applicant errors separate from board errors', async () => {
    const { boards, applicants } = await initializedStores()
    const board = boards.boards[0]

    expect(board).toBeDefined()
    if (!board) return

    await boards.deleteColumn(board.id, 's1')
    await applicants.createApplicant('missing-board', {
      name: 'Liam Price',
      email: '',
      phone: '',
    })

    expect(boards.error).toBe('The first column cannot be deleted.')
    expect(applicants.error).toBe('Add a column to this board before creating an applicant.')
  })

  it('resets timers and snapshots', async () => {
    const { applicants } = await initializedStores()
    const candidate = applicants.candidateById('c1')

    expect(candidate).toBeDefined()
    if (!candidate) return

    applicants.updateCandidateField(candidate.id, 'email', 'changed@example.com')
    applicants.reset()

    expect(applicants.error).toBeNull()
  })
})
