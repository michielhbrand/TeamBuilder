import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import type { Board, Candidate } from '@/types/pipeline'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  onAuthStateChange: vi.fn<(...args: unknown[]) => unknown>(),
  signInWithPassword: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  verifyOtp: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  updateUser: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  signOut: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchApplicantEvents: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchApplicantNotes: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mocks,
  },
}))
vi.mock('@/lib/activity-api', () => ({
  fetchApplicantEvents: mocks.fetchApplicantEvents,
  fetchApplicantNotes: mocks.fetchApplicantNotes,
  createApplicantNote: vi.fn<(...args: unknown[]) => unknown>(),
  recordApplicantEditEvent: vi.fn<(...args: unknown[]) => unknown>(),
}))

import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useApplicantsStore } from '@/stores/applicants'
import { useAuthStore } from '@/stores/auth'
import { useBoardsStore } from '@/stores/boards'

const candidate: Candidate = {
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
}

const board: Board = {
  id: 'b1',
  name: 'Frontend Engineer',
  department: 'Engineering',
  openPositions: 1,
  deadline: '2026-12-31',
  steps: [{ id: 's1', name: 'Applied', position: 0 }],
  candidates: [candidate],
}

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'user-1',
    email: 'demo@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  },
} as unknown as Session

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn<() => void>() } },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes from the existing Supabase session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    const auth = useAuthStore()

    await auth.initialize()

    expect(auth.initialized).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user?.email).toBe('demo@example.com')
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce()
  })

  it('signs in with email and password', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
    const auth = useAuthStore()

    const signedIn = await auth.signIn('demo@example.com', 'password')

    expect(signedIn).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'demo@example.com',
      password: 'password',
    })
  })

  it('exposes a friendly message for invalid credentials', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    })
    const auth = useAuthStore()

    const signedIn = await auth.signIn('demo@example.com', 'wrong-password')

    expect(signedIn).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.error).toBe('Invalid email or password.')
  })

  it('verifies an invite token hash and starts password setup', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session }, error: null })
    const auth = useAuthStore()
    auth.linkType = 'invite'
    auth.linkTokenHash = 'token-hash'

    const verified = await auth.verifyLink()

    expect(verified).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.passwordSetupRequired).toBe(true)
    expect(auth.linkTokenHash).toBeNull()
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'token-hash',
      type: 'invite',
    })
  })

  it('explains a consumed invite token', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: new Error('Email link is invalid or has expired'),
    })
    const auth = useAuthStore()
    auth.linkType = 'invite'
    auth.linkTokenHash = 'used-token'

    const verified = await auth.verifyLink()

    expect(verified).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.error).toBe('This link is invalid or has expired. Ask for a new invitation.')
  })

  it('sets a password and clears the setup requirement', async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: session.user }, error: null })
    const auth = useAuthStore()
    auth.passwordSetupRequired = true

    const updated = await auth.setPassword('new-password')

    expect(updated).toBe(true)
    expect(auth.passwordSetupRequired).toBe(false)
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
  })

  it('explains a password that is too short', async () => {
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Password should be at least 8 characters'),
    })
    const auth = useAuthStore()

    const updated = await auth.setPassword('short')

    expect(updated).toBe(false)
    expect(auth.error).toBe('Password must be at least 8 characters.')
  })

  it('requires a full name and persists it to user metadata', async () => {
    const updatedUser = {
      ...session.user,
      user_metadata: { full_name: 'Ada Lovelace' },
    }
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.updateUser.mockResolvedValue({ data: { user: updatedUser }, error: null })
    const auth = useAuthStore()
    await auth.initialize()

    expect(auth.fullName).toBe('')
    expect(auth.fullNameRequired).toBe(true)
    expect(auth.actorName).toBe('demo@example.com')

    const saved = await auth.updateFullName('  Ada Lovelace  ')

    expect(saved).toBe(true)
    expect(auth.fullName).toBe('Ada Lovelace')
    expect(auth.fullNameRequired).toBe(false)
    expect(auth.actorName).toBe('Ada Lovelace')
    expect(mocks.updateUser).toHaveBeenCalledWith({
      data: { full_name: 'Ada Lovelace' },
    })
  })

  it('rejects an empty full name', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    const auth = useAuthStore()
    await auth.initialize()

    const saved = await auth.updateFullName('   ')

    expect(saved).toBe(false)
    expect(auth.error).toBe('Enter your full name.')
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('resets workspace stores when Supabase reports a signed-out session', async () => {
    let handler: ((event: string, nextSession: Session | null) => void) | undefined
    mocks.onAuthStateChange.mockImplementation((callback) => {
      handler = callback as (event: string, nextSession: Session | null) => void
      return { data: { subscription: { unsubscribe: vi.fn<() => void>() } } }
    })
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.fetchApplicantEvents.mockResolvedValue([
      {
        id: 'e1',
        boardId: 'b1',
        applicantId: 'c1',
        actorName: 'Emma Brand',
        action: 'created',
        message: 'Emma Brand created Amara Okafor',
        createdAt: '2026-11-09T10:00:00Z',
      },
    ])
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

    const auth = useAuthStore()
    await auth.initialize()

    const boards = useBoardsStore()
    const applicants = useApplicantsStore()
    const activity = useApplicantActivityStore()
    boards.boards = [board]
    boards.initialized = true

    vi.useFakeTimers()
    applicants.updateCandidateField('c1', 'name', 'Amara O.')
    await activity.loadEvents('c1')
    await activity.loadNotes('c1')

    expect(applicants.pendingProfileValues('c1')).toEqual({ name: 'Amara O.' })
    expect(activity.eventsFor('c1')).toHaveLength(1)
    expect(activity.notesFor('c1')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(1)
    expect(handler).toBeTypeOf('function')

    handler?.('SIGNED_OUT', null)

    expect(auth.isAuthenticated).toBe(false)
    expect(boards.boards).toEqual([])
    expect(boards.initialized).toBe(false)
    expect(activity.eventsFor('c1')).toEqual([])
    expect(activity.notesFor('c1')).toEqual([])
    expect(applicants.pendingProfileValues('c1')).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the session on sign out', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.signOut.mockResolvedValue({ error: null })
    const auth = useAuthStore()
    await auth.initialize()

    await auth.signOut()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
})
