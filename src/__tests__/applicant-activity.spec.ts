import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Board, Candidate } from '@/types/pipeline'

const mocks = vi.hoisted(() => ({
  fetchBoards: vi.fn<() => Promise<unknown>>(),
  deleteApplicant: vi.fn<(...args: unknown[]) => unknown>(),
  fetchApplicantEvents: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchApplicantNotes: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createApplicantNote: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
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
  updateApplicant: vi.fn<(...args: unknown[]) => unknown>(),
  deleteApplicant: mocks.deleteApplicant,
}))
vi.mock('@/lib/activity-api', () => ({
  fetchApplicantEvents: mocks.fetchApplicantEvents,
  fetchApplicantNotes: mocks.fetchApplicantNotes,
  createApplicantNote: mocks.createApplicantNote,
  recordApplicantEditEvent: vi.fn<(...args: unknown[]) => unknown>(),
}))
vi.mock('@/lib/storage-api', () => ({
  uploadApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
  deleteApplicantCv: vi.fn<(...args: unknown[]) => unknown>(),
}))

import { useApplicantActivityStore } from '@/stores/applicant-activity'
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
  const activity = useApplicantActivityStore()
  return { boards, applicants, activity }
}

describe('applicant activity store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.fetchBoards.mockResolvedValue([makeBoard()])
    mocks.deleteApplicant.mockResolvedValue(undefined)
    mocks.fetchApplicantEvents.mockResolvedValue([])
    mocks.fetchApplicantNotes.mockResolvedValue([])
    mocks.createApplicantNote.mockImplementation(async (input) => {
      const note = input as {
        boardId: string
        applicantId: string
        authorName: string
        body: string
      }

      return {
        id: 'n1',
        boardId: note.boardId,
        applicantId: note.applicantId,
        authorName: note.authorName,
        body: note.body,
        createdAt: '2026-11-09T10:00:00Z',
      }
    })
  })

  it('loads applicant events from the backend', async () => {
    const { activity } = await initializedStores()

    const event = {
      id: 'e1',
      boardId: 'b1',
      applicantId: 'c1',
      actorName: 'Emma Brand',
      action: 'edited',
      message: 'Emma Brand has edited Amara Okafor details',
      createdAt: '2026-11-09T10:00:00Z',
    }
    mocks.fetchApplicantEvents.mockResolvedValue([event])

    await activity.loadEvents('c1')

    expect(mocks.fetchApplicantEvents).toHaveBeenCalledWith('b1', 'c1')
    expect(activity.eventsFor('c1')).toEqual([event])
  })

  it('loads applicant notes from the backend', async () => {
    const { activity } = await initializedStores()

    const note = {
      id: 'n1',
      boardId: 'b1',
      applicantId: 'c1',
      authorName: 'Emma Brand',
      body: 'Strong portfolio.',
      createdAt: '2026-11-09T10:00:00Z',
    }
    mocks.fetchApplicantNotes.mockResolvedValue([note])

    await activity.loadNotes('c1')

    expect(mocks.fetchApplicantNotes).toHaveBeenCalledWith('b1', 'c1')
    expect(activity.notesFor('c1')).toEqual([note])
  })

  it('adds applicant notes to the front of the list', async () => {
    const { activity } = await initializedStores()

    const added = await activity.addNote('c1', '  Follow up Friday.  ', 'Emma Brand')

    expect(added).toBe(true)
    expect(mocks.createApplicantNote).toHaveBeenCalledExactlyOnceWith({
      boardId: 'b1',
      applicantId: 'c1',
      authorName: 'Emma Brand',
      body: 'Follow up Friday.',
    })
    expect(activity.notesFor('c1')[0]).toEqual({
      id: 'n1',
      boardId: 'b1',
      applicantId: 'c1',
      authorName: 'Emma Brand',
      body: 'Follow up Friday.',
      createdAt: '2026-11-09T10:00:00Z',
    })
  })

  it('does not save empty applicant notes', async () => {
    const { activity } = await initializedStores()

    const added = await activity.addNote('c1', '   ', 'Emma Brand')

    expect(added).toBe(false)
    expect(mocks.createApplicantNote).not.toHaveBeenCalled()
  })

  it('forgets applicant notes when the applicant is deleted', async () => {
    const { applicants, activity } = await initializedStores()

    mocks.fetchApplicantNotes.mockResolvedValue([
      {
        id: 'n1',
        boardId: 'b1',
        applicantId: 'c1',
        authorName: 'Emma Brand',
        body: 'Strong portfolio.',
        createdAt: '2026-11-09T10:00:00Z',
      },
    ])
    await activity.loadNotes('c1')

    expect(activity.notesFor('c1')).toHaveLength(1)

    const removed = await applicants.deleteApplicant('c1')

    expect(removed).toBe(true)
    expect(activity.notesFor('c1')).toEqual([])
  })

  it('keeps activity errors separate from applicant errors', async () => {
    const { applicants, activity } = await initializedStores()

    mocks.createApplicantNote.mockRejectedValue(new Error('notes unavailable'))
    await activity.addNote('c1', 'Follow up', 'Emma Brand')

    const created = await applicants.createApplicant('missing-board', {
      name: 'Liam Price',
      email: '',
      phone: '',
    })

    expect(created).toBeNull()
    expect(activity.error).toBe('notes unavailable')
    expect(applicants.error).toBe('Add a column to this board before creating an applicant.')
  })
})
