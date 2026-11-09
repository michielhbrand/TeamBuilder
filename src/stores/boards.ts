import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/lib/boards-api'
import {
  defaultApplicantStep,
  flattenBoards,
  groupBoards,
  nextStep,
  summariseBoard,
  summariseBoards,
} from '@/lib/pipeline'
import type {
  ApplicantInput,
  Board,
  BoardInput,
  BoardSummary,
  Candidate,
  CandidateStatus,
  PipelineStep,
} from '@/types/pipeline'

interface CandidateContext {
  board: Board
  candidate: Candidate
}

export type EditableCandidateField =
  'name' | 'email' | 'phone' | 'currentRole' | 'education' | 'experience'

const SAVE_DELAY_MS = 500

function friendlyDataError(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('boards_department_name_lower_key') ||
    normalized.includes('boards_name_lower_key') ||
    normalized.includes('boards_name_unique')
  ) {
    return 'A board with that name already exists in this department.'
  }

  if (normalized.includes('applicants_board_email_lower_key')) {
    return 'An applicant with that email already exists on this board.'
  }

  if (normalized.includes('applicants_board_phone_key')) {
    return 'An applicant with that phone number already exists on this board.'
  }

  if (normalized.includes('board_columns_board_name_lower_key')) {
    return 'A column with that name already exists on this board.'
  }

  if (normalized.includes('first board column')) {
    return 'The first column cannot be deleted.'
  }

  return message
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return friendlyDataError(error.message)
  }

  return 'Could not save changes. Please try again.'
}

export const useBoardsStore = defineStore('boards', () => {
  const boards = ref<Board[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const groups = computed(() => groupBoards(boards.value))
  const orderedBoards = computed(() => flattenBoards(groups.value))
  const summaries = computed(() => boards.value.map(summariseBoard))
  const totals = computed(() => summariseBoards(boards.value))
  const needsAttention = computed(() =>
    summaries.value
      .filter((summary) => summary.overdue)
      .sort((a, b) => a.board.deadline.localeCompare(b.board.deadline)),
  )

  function boardById(id: string): Board | undefined {
    return boards.value.find((board) => board.id === id)
  }

  function summaryById(id: string): BoardSummary | undefined {
    return summaries.value.find((summary) => summary.board.id === id)
  }

  function candidateById(id: string): Candidate | undefined {
    return candidateContext(id)?.candidate
  }

  function candidateContext(candidateId: string): CandidateContext | undefined {
    for (const board of boards.value) {
      const candidate = board.candidates.find((item) => item.id === candidateId)

      if (candidate) {
        return { board, candidate }
      }
    }

    return undefined
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      boards.value = await api.fetchBoards()
      initialized.value = true
    } catch (caught) {
      error.value = errorMessage(caught)
    } finally {
      loading.value = false
    }
  }

  async function createBoard(input: BoardInput): Promise<Board | undefined> {
    loading.value = true
    error.value = null

    try {
      const board = await api.createBoard(input)
      boards.value = [...boards.value, board]
      return board
    } catch (caught) {
      error.value = errorMessage(caught)
      return undefined
    } finally {
      loading.value = false
    }
  }

  async function updateBoard(id: string, input: Partial<BoardInput>): Promise<boolean> {
    error.value = null

    try {
      await api.updateBoard(id, input)
      const board = boardById(id)

      if (board) {
        Object.assign(board, input)
      }

      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function deleteBoard(id: string): Promise<boolean> {
    error.value = null
    const board = boardById(id)
    const cvPaths =
      board?.candidates
        .map((candidate) => candidate.cvPath)
        .filter((path): path is string => Boolean(path)) ?? []
    const jobSpecPath = board?.jobSpecPath ?? null

    try {
      await api.deleteBoard(id)
      boards.value = boards.value.filter((item) => item.id !== id)
      await removeCvObjects(cvPaths)

      if (jobSpecPath) {
        try {
          await api.deleteBoardJobSpec(jobSpecPath)
        } catch {
          // The board is already deleted; a missing object is not actionable here.
        }
      }

      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function removeCvObjects(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await api.deleteApplicantCv(path)
      } catch {
        // The applicant is already deleted; a missing object is not actionable here.
      }
    }
  }

  async function addColumn(boardId: string, name: string): Promise<boolean> {
    error.value = null
    const board = boardById(boardId)

    if (!board) {
      return false
    }

    try {
      const column = await api.addBoardColumn(boardId, name.trim())
      const position = board.steps.reduce((max, step) => Math.max(max, step.position), -1) + 1
      board.steps = [...board.steps, { ...column, position }].sort(
        (a, b) => a.position - b.position,
      )
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function renameColumn(boardId: string, stepId: string, name: string): Promise<boolean> {
    error.value = null
    const board = boardById(boardId)
    const step = board?.steps.find((item) => item.id === stepId)

    if (!board || !step) {
      return false
    }

    try {
      await api.renameBoardColumn(stepId, name.trim())
      step.name = name.trim()
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function reorderColumns(boardId: string, stepIds: string[]): Promise<boolean> {
    error.value = null
    const board = boardById(boardId)
    const first = board?.steps[0]

    if (!board || !first || stepIds[0] !== first.id || stepIds.length !== board.steps.length) {
      error.value = 'The first column must stay first.'
      return false
    }

    const byId = new Map(board.steps.map((step) => [step.id, step]))
    const ordered = stepIds.map((id) => byId.get(id))

    if (ordered.some((step) => !step)) {
      error.value = 'The column order is no longer valid. Reload the board and try again.'
      return false
    }

    try {
      await api.reorderBoardColumns(boardId, stepIds)
      const steps = ordered as PipelineStep[]
      steps.forEach((step, position) => {
        step.position = position
      })
      board.steps = steps
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function deleteColumn(boardId: string, stepId: string): Promise<boolean> {
    error.value = null
    const board = boardById(boardId)
    const step = board?.steps.find((item) => item.id === stepId)
    const first = board?.steps[0]

    if (!board || !step || !first || first.id === stepId) {
      error.value = 'The first column cannot be deleted.'
      return false
    }

    try {
      await api.deleteBoardColumn(stepId)
      const now = new Date().toISOString()
      board.candidates.forEach((candidate) => {
        if (candidate.stepId === stepId) {
          candidate.stepId = first.id
          candidate.stepEnteredAt = now
        }
      })
      board.steps = board.steps.filter((item) => item.id !== stepId)
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function createApplicant(
    boardId: string,
    input: ApplicantInput,
    cvFile?: File | null,
  ): Promise<Candidate | null> {
    error.value = null
    const board = boardById(boardId)
    const defaultStep = board ? defaultApplicantStep(board) : undefined

    if (!board || !defaultStep) {
      error.value = 'Add a column to this board before creating an applicant.'
      return null
    }

    const stepId =
      input.stepId && board.steps.some((step) => step.id === input.stepId)
        ? input.stepId
        : defaultStep.id

    try {
      const candidate = await api.createApplicant(boardId, stepId, {
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        currentRole: input.currentRole?.trim() ?? '',
        education: input.education ?? '',
        experience: input.experience ?? '',
      })
      board.candidates = [...board.candidates, candidate]

      if (cvFile) {
        await uploadCv(candidate.id, cvFile)
      }

      return candidate
    } catch (caught) {
      error.value = errorMessage(caught)
      return null
    }
  }

  async function deleteApplicant(candidateId: string): Promise<boolean> {
    error.value = null
    const context = candidateContext(candidateId)

    if (!context) {
      return false
    }

    const cvPath = context.candidate.cvPath

    try {
      clearSaveTimer(candidateId)
      await api.deleteApplicant(candidateId)
      context.board.candidates = context.board.candidates.filter(
        (candidate) => candidate.id !== candidateId,
      )

      if (cvPath) {
        await removeCvObjects([cvPath])
      }

      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function uploadCv(candidateId: string, file: File): Promise<boolean> {
    error.value = null
    const context = candidateContext(candidateId)

    if (!context) {
      return false
    }

    try {
      const previousPath = context.candidate.cvPath ?? null
      const uploaded = await api.uploadApplicantCv(candidateId, file)

      if (previousPath && previousPath !== uploaded.path) {
        await removeCvObjects([previousPath])
      }

      context.candidate.cvPath = uploaded.path
      context.candidate.cvName = uploaded.name
      await api.updateApplicant(candidateId, {
        cvPath: uploaded.path,
        cvName: uploaded.name,
      })
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function removeCv(candidateId: string): Promise<boolean> {
    error.value = null
    const context = candidateContext(candidateId)
    const path = context?.candidate.cvPath

    if (!context || !path) {
      return false
    }

    try {
      await api.deleteApplicantCv(path)
      context.candidate.cvPath = null
      context.candidate.cvName = null
      await api.updateApplicant(candidateId, { cvPath: null, cvName: null })
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function cvSignedUrl(path: string): Promise<string | undefined> {
    error.value = null

    try {
      return await api.createApplicantCvUrl(path)
    } catch (caught) {
      error.value = errorMessage(caught)
      return undefined
    }
  }

  async function cvBlob(path: string): Promise<Blob | undefined> {
    error.value = null

    try {
      return await api.downloadApplicantCv(path)
    } catch (caught) {
      error.value = errorMessage(caught)
      return undefined
    }
  }

  async function uploadJobSpec(boardId: string, file: File): Promise<boolean> {
    error.value = null
    const board = boardById(boardId)

    if (!board) {
      return false
    }

    try {
      const uploaded = await api.uploadBoardJobSpec(boardId, file)
      await api.updateBoardJobSpec(boardId, uploaded.path, uploaded.name)
      board.jobSpecPath = uploaded.path
      board.jobSpecName = uploaded.name
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function removeJobSpec(boardId: string): Promise<boolean> {
    error.value = null
    const board = boardById(boardId)
    const path = board?.jobSpecPath

    if (!board || !path) {
      return false
    }

    try {
      await api.deleteBoardJobSpec(path)
      await api.updateBoardJobSpec(boardId, null, null)
      board.jobSpecPath = null
      board.jobSpecName = null
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function jobSpecSignedUrl(path: string): Promise<string | undefined> {
    error.value = null

    try {
      return await api.createBoardJobSpecUrl(path)
    } catch (caught) {
      error.value = errorMessage(caught)
      return undefined
    }
  }

  async function jobSpecBlob(path: string): Promise<Blob | undefined> {
    error.value = null

    try {
      return await api.downloadBoardJobSpec(path)
    } catch (caught) {
      error.value = errorMessage(caught)
      return undefined
    }
  }

  function updateCandidateField(
    candidateId: string,
    field: EditableCandidateField,
    value: string,
  ): void {
    const context = candidateContext(candidateId)

    if (context) {
      context.candidate[field] = value
      scheduleSave(candidateId)
    }
  }

  function toggleFavorite(candidateId: string): void {
    const context = candidateContext(candidateId)

    if (context) {
      context.candidate.favorite = !context.candidate.favorite
      scheduleSave(candidateId)
    }
  }

  function moveCandidate(candidateId: string, stepId: string): void {
    const context = candidateContext(candidateId)

    if (!context || !context.board.steps.some((step) => step.id === stepId)) {
      return
    }

    const now = new Date().toISOString()
    context.candidate.stepId = stepId
    context.candidate.status = 'active'
    context.candidate.stepEnteredAt = now

    void api
      .updateApplicant(candidateId, {
        columnId: stepId,
        status: 'active',
        stepEnteredAt: now,
      })
      .catch((caught) => {
        error.value = errorMessage(caught)
      })
  }

  function advanceCandidate(candidateId: string): void {
    const context = candidateContext(candidateId)

    if (!context) {
      return
    }

    const next = nextStep(context.board, context.candidate)

    if (next) {
      moveCandidate(candidateId, next.id)
    }
  }

  function setCandidateStatus(candidateId: string, status: CandidateStatus): void {
    const context = candidateContext(candidateId)

    if (!context) {
      return
    }

    context.candidate.status = status

    void api.updateApplicant(candidateId, { status }).catch((caught) => {
      error.value = errorMessage(caught)
    })
  }

  function hireCandidate(candidateId: string): void {
    setCandidateStatus(candidateId, 'hired')
  }

  function rejectCandidate(candidateId: string): void {
    setCandidateStatus(candidateId, 'rejected')
  }

  function reopenCandidate(candidateId: string): void {
    setCandidateStatus(candidateId, 'active')
  }

  function clearSaveTimer(candidateId: string): void {
    const timer = saveTimers.get(candidateId)

    if (timer) {
      clearTimeout(timer)
      saveTimers.delete(candidateId)
    }
  }

  function scheduleSave(candidateId: string): void {
    clearSaveTimer(candidateId)
    saveTimers.set(
      candidateId,
      setTimeout(() => {
        saveTimers.delete(candidateId)
        void persistCandidate(candidateId)
      }, SAVE_DELAY_MS),
    )
  }

  async function persistCandidate(candidateId: string): Promise<void> {
    const candidate = candidateById(candidateId)

    if (!candidate) {
      return
    }

    try {
      await api.updateApplicant(candidateId, {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        currentRole: candidate.currentRole,
        education: candidate.education,
        experience: candidate.experience,
        favorite: candidate.favorite,
        status: candidate.status,
        columnId: candidate.stepId,
      })
    } catch (caught) {
      error.value = errorMessage(caught)
    }
  }

  async function flushCandidate(candidateId: string): Promise<void> {
    clearSaveTimer(candidateId)
    await persistCandidate(candidateId)
  }

  function reset(): void {
    for (const timer of saveTimers.values()) {
      clearTimeout(timer)
    }

    saveTimers.clear()
    boards.value = []
    initialized.value = false
    loading.value = false
    error.value = null
  }

  return {
    boards,
    loading,
    initialized,
    error,
    groups,
    orderedBoards,
    summaries,
    totals,
    needsAttention,
    boardById,
    summaryById,
    candidateById,
    initialize,
    createBoard,
    updateBoard,
    deleteBoard,
    addColumn,
    renameColumn,
    reorderColumns,
    deleteColumn,
    createApplicant,
    deleteApplicant,
    uploadCv,
    removeCv,
    cvSignedUrl,
    cvBlob,
    uploadJobSpec,
    removeJobSpec,
    jobSpecSignedUrl,
    jobSpecBlob,
    updateCandidateField,
    toggleFavorite,
    advanceCandidate,
    moveCandidate,
    hireCandidate,
    rejectCandidate,
    reopenCandidate,
    flushCandidate,
    reset,
  }
})
