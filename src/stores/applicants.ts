import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/lib/applicants-api'
import { defaultApplicantStep, nextStep } from '@/lib/pipeline'
import { errorMessage } from '@/lib/store-errors'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useBoardsStore } from '@/stores/boards'
import { useStorageStore } from '@/stores/storage'
import type { ApplicantInput, Board, Candidate, CandidateStatus } from '@/types/pipeline'

interface CandidateContext {
  board: Board
  candidate: Candidate
}

export type EditableCandidateField =
  'name' | 'email' | 'phone' | 'currentRole' | 'education' | 'experience'

type ProfileSnapshot = Pick<
  Candidate,
  | 'name'
  | 'email'
  | 'phone'
  | 'currentRole'
  | 'education'
  | 'experience'
  | 'favorite'
  | 'cvPath'
  | 'cvName'
>

const SAVE_DELAY_MS = 500

export const useApplicantsStore = defineStore('applicants', () => {
  const boards = useBoardsStore()
  const error = ref<string | null>(null)
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const editSnapshots = new Map<string, ProfileSnapshot>()

  function candidateById(id: string): Candidate | undefined {
    return candidateContext(id)?.candidate
  }

  function candidateContext(candidateId: string): CandidateContext | undefined {
    for (const board of boards.boards) {
      const candidate = board.candidates.find((item) => item.id === candidateId)

      if (candidate) {
        return { board, candidate }
      }
    }

    return undefined
  }

  function profileSnapshot(candidate: Candidate): ProfileSnapshot {
    return {
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      currentRole: candidate.currentRole,
      education: candidate.education,
      experience: candidate.experience,
      favorite: candidate.favorite,
      cvPath: candidate.cvPath ?? null,
      cvName: candidate.cvName ?? null,
    }
  }

  function profileChanged(snapshot: ProfileSnapshot, candidate: Candidate): boolean {
    const current = profileSnapshot(candidate)
    return (Object.keys(current) as Array<keyof ProfileSnapshot>).some(
      (key) => current[key] !== snapshot[key],
    )
  }

  function beginCandidateEdit(candidateId: string): void {
    const context = candidateContext(candidateId)

    if (context) {
      editSnapshots.set(candidateId, profileSnapshot(context.candidate))
    } else {
      editSnapshots.delete(candidateId)
    }
  }

  async function createApplicant(
    boardId: string,
    input: ApplicantInput,
    cvFile?: File | null,
  ): Promise<Candidate | null> {
    error.value = null
    const board = boards.boardById(boardId)
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
        await useStorageStore().uploadCv(candidate.id, cvFile)
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
      editSnapshots.delete(candidateId)
      useApplicantActivityStore().forgetCandidate(candidateId)

      if (cvPath) {
        await useStorageStore().removeCvObjectsQuietly([cvPath])
      }

      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
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

  async function moveCandidate(candidateId: string, stepId: string): Promise<void> {
    const context = candidateContext(candidateId)

    if (
      !context ||
      !context.board.steps.some((step) => step.id === stepId) ||
      context.candidate.stepId === stepId
    ) {
      return
    }

    const now = new Date().toISOString()
    context.candidate.stepId = stepId
    context.candidate.status = 'active'
    context.candidate.stepEnteredAt = now

    try {
      await api.updateApplicant(candidateId, {
        columnId: stepId,
        status: 'active',
        stepEnteredAt: now,
      })
    } catch (caught) {
      error.value = errorMessage(caught)
    }
  }

  async function advanceCandidate(candidateId: string): Promise<void> {
    const context = candidateContext(candidateId)

    if (!context) {
      return
    }

    const next = nextStep(context.board, context.candidate)

    if (next) {
      await moveCandidate(candidateId, next.id)
    }
  }

  async function setCandidateStatus(candidateId: string, status: CandidateStatus): Promise<void> {
    const context = candidateContext(candidateId)

    if (!context || context.candidate.status === status) {
      return
    }

    context.candidate.status = status

    try {
      await api.updateApplicant(candidateId, { status })
    } catch (caught) {
      error.value = errorMessage(caught)
    }
  }

  async function hireCandidate(candidateId: string): Promise<void> {
    await setCandidateStatus(candidateId, 'hired')
  }

  async function rejectCandidate(candidateId: string): Promise<void> {
    await setCandidateStatus(candidateId, 'rejected')
  }

  async function reopenCandidate(candidateId: string): Promise<void> {
    await setCandidateStatus(candidateId, 'active')
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

  async function persistCandidate(candidateId: string): Promise<boolean> {
    const candidate = candidateById(candidateId)

    if (!candidate) {
      return false
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
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function flushCandidate(candidateId: string): Promise<void> {
    clearSaveTimer(candidateId)
    const context = candidateContext(candidateId)
    const snapshot = editSnapshots.get(candidateId)
    const saved = await persistCandidate(candidateId)
    editSnapshots.delete(candidateId)

    if (!saved || !context || !snapshot || !profileChanged(snapshot, context.candidate)) {
      return
    }

    await useApplicantActivityStore().recordEdit(candidateId)
  }

  function forgetCandidate(candidateId: string): void {
    clearSaveTimer(candidateId)
    editSnapshots.delete(candidateId)
  }

  function forgetCandidates(candidateIds: string[]): void {
    candidateIds.forEach(forgetCandidate)
  }

  function reset(): void {
    for (const timer of saveTimers.values()) {
      clearTimeout(timer)
    }

    saveTimers.clear()
    editSnapshots.clear()
    error.value = null
  }

  return {
    error,
    candidateById,
    createApplicant,
    deleteApplicant,
    updateCandidateField,
    toggleFavorite,
    advanceCandidate,
    moveCandidate,
    hireCandidate,
    rejectCandidate,
    reopenCandidate,
    flushCandidate,
    beginCandidateEdit,
    forgetCandidate,
    forgetCandidates,
    reset,
  }
})
