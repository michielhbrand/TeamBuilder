import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/lib/applicants-api'
import { entriesEqual } from '@/lib/career'
import { defaultApplicantStep, nextStep } from '@/lib/pipeline'
import { errorMessage } from '@/lib/store-errors'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useBoardsStore } from '@/stores/boards'
import { useStorageStore } from '@/stores/storage'
import type {
  ApplicantInput,
  Board,
  Candidate,
  CandidateStatus,
  CareerEntry,
  CareerKind,
} from '@/types/pipeline'

interface CandidateContext {
  board: Board
  candidate: Candidate
}

export type EditableCandidateField = 'name' | 'email' | 'phone' | 'currentRole'

type SavableCandidateField = EditableCandidateField | CareerKind | 'favorite'
export type PendingProfileValues = Partial<Pick<Candidate, SavableCandidateField>>

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
  const unsavedCandidates = ref<Record<string, boolean>>({})
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const editSnapshots = new Map<string, ProfileSnapshot>()
  const dirtyFields = new Map<string, Set<SavableCandidateField>>()

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
    return (Object.keys(current) as Array<keyof ProfileSnapshot>).some((key) => {
      const before = snapshot[key]
      const after = current[key]

      return Array.isArray(before) && Array.isArray(after)
        ? !entriesEqual(before, after)
        : before !== after
    })
  }

  function hasUnsavedChanges(candidateId: string): boolean {
    return unsavedCandidates.value[candidateId] === true
  }

  function setUnsaved(candidateId: string, unsaved: boolean): void {
    const next = { ...unsavedCandidates.value }

    if (unsaved) {
      next[candidateId] = true
    } else {
      delete next[candidateId]
    }

    unsavedCandidates.value = next
  }

  function beginCandidateEdit(candidateId: string): void {
    const context = candidateContext(candidateId)

    if (context) {
      editSnapshots.set(candidateId, profileSnapshot(context.candidate))
    } else {
      editSnapshots.delete(candidateId)
    }
  }

  function markDirty(candidateId: string, field: SavableCandidateField): void {
    const fields = dirtyFields.get(candidateId) ?? new Set<SavableCandidateField>()
    fields.add(field)
    dirtyFields.set(candidateId, fields)
  }

  function pendingProfileValues(candidateId: string): PendingProfileValues | undefined {
    const fields = dirtyFields.get(candidateId)
    const candidate = candidateById(candidateId)

    if (!fields?.size || !candidate) {
      return undefined
    }

    return Object.fromEntries(
      [...fields].map((field) => [field, candidate[field]]),
    ) as PendingProfileValues
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
        education: input.education ?? [],
        experience: input.experience ?? [],
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
      dirtyFields.delete(candidateId)
      setUnsaved(candidateId, false)
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
      markDirty(candidateId, field)
      scheduleSave(candidateId)
    }
  }

  function updateCandidateEntries(
    candidateId: string,
    field: CareerKind,
    entries: CareerEntry[],
  ): void {
    const context = candidateContext(candidateId)

    if (context) {
      context.candidate[field] = entries
      markDirty(candidateId, field)
      scheduleSave(candidateId)
    }
  }

  function toggleFavorite(candidateId: string): void {
    const context = candidateContext(candidateId)

    if (context) {
      context.candidate.favorite = !context.candidate.favorite
      markDirty(candidateId, 'favorite')
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

    error.value = null
    const previousStepId = context.candidate.stepId
    const previousStatus = context.candidate.status
    const previousStepEnteredAt = context.candidate.stepEnteredAt
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
      if (context.candidate.stepId === stepId) {
        context.candidate.stepId = previousStepId
      }

      if (context.candidate.status === 'active') {
        context.candidate.status = previousStatus
      }

      if (context.candidate.stepEnteredAt === now) {
        context.candidate.stepEnteredAt = previousStepEnteredAt
      }

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

    error.value = null
    const previousStatus = context.candidate.status
    context.candidate.status = status

    try {
      await api.updateApplicant(candidateId, { status })
    } catch (caught) {
      if (context.candidate.status === status) {
        context.candidate.status = previousStatus
      }

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
    const fields = dirtyFields.get(candidateId)

    if (!candidate) {
      return false
    }

    if (!fields?.size) {
      error.value = null
      return true
    }

    const savedFields = new Set(fields)
    const patch = Object.fromEntries(
      [...savedFields].map((field) => [field, candidate[field]]),
    ) as PendingProfileValues

    try {
      await api.updateApplicant(candidateId, patch)
      const remaining = dirtyFields.get(candidateId)

      if (remaining) {
        savedFields.forEach((field) => {
          if (candidate[field] === patch[field]) {
            remaining.delete(field)
          }
        })

        if (!remaining.size) {
          dirtyFields.delete(candidateId)
        }
      }

      setUnsaved(candidateId, false)
      error.value = null

      if (dirtyFields.has(candidateId)) {
        scheduleSave(candidateId)
      }

      return true
    } catch (caught) {
      setUnsaved(candidateId, true)
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
    dirtyFields.delete(candidateId)
    setUnsaved(candidateId, false)
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
    dirtyFields.clear()
    unsavedCandidates.value = {}
    error.value = null
  }

  return {
    error,
    candidateById,
    hasUnsavedChanges,
    pendingProfileValues,
    createApplicant,
    deleteApplicant,
    updateCandidateField,
    updateCandidateEntries,
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
