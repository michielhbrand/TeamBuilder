import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/lib/activity-api'
import { errorMessage } from '@/lib/store-errors'
import { useApplicantsStore } from '@/stores/applicants'
import { useAuthStore } from '@/stores/auth'
import type { ApplicantEvent, ApplicantNote } from '@/types/pipeline'

export const useApplicantActivityStore = defineStore('applicant-activity', () => {
  const applicants = useApplicantsStore()
  const auth = useAuthStore()
  const error = ref<string | null>(null)
  const applicantEvents = ref<Record<string, ApplicantEvent[]>>({})
  const applicantEventsLoading = ref<Record<string, boolean>>({})
  const applicantNotes = ref<Record<string, ApplicantNote[]>>({})
  const applicantNotesLoading = ref<Record<string, boolean>>({})

  function eventsFor(candidateId: string): ApplicantEvent[] {
    return applicantEvents.value[candidateId] ?? []
  }

  function eventsLoadingFor(candidateId: string): boolean {
    return Boolean(applicantEventsLoading.value[candidateId])
  }

  function setEventsLoading(candidateId: string, value: boolean): void {
    applicantEventsLoading.value = { ...applicantEventsLoading.value, [candidateId]: value }
  }

  function notesFor(candidateId: string): ApplicantNote[] {
    return applicantNotes.value[candidateId] ?? []
  }

  function notesLoadingFor(candidateId: string): boolean {
    return Boolean(applicantNotesLoading.value[candidateId])
  }

  function setNotesLoading(candidateId: string, value: boolean): void {
    applicantNotesLoading.value = { ...applicantNotesLoading.value, [candidateId]: value }
  }

  function forgetCandidate(candidateId: string): void {
    if (applicantNotes.value[candidateId]) {
      const next = { ...applicantNotes.value }
      delete next[candidateId]
      applicantNotes.value = next
    }

    if (applicantNotesLoading.value[candidateId]) {
      const next = { ...applicantNotesLoading.value }
      delete next[candidateId]
      applicantNotesLoading.value = next
    }

    if (applicantEvents.value[candidateId]) {
      const next = { ...applicantEvents.value }
      delete next[candidateId]
      applicantEvents.value = next
    }

    if (applicantEventsLoading.value[candidateId]) {
      const next = { ...applicantEventsLoading.value }
      delete next[candidateId]
      applicantEventsLoading.value = next
    }
  }

  function forgetCandidates(candidateIds: string[]): void {
    candidateIds.forEach(forgetCandidate)
  }

  async function loadEvents(candidateId: string): Promise<void> {
    const candidate = applicants.candidateById(candidateId)

    if (!candidate) {
      return
    }

    setEventsLoading(candidateId, true)

    try {
      const events = await api.fetchApplicantEvents(candidate.boardId, candidateId)
      applicantEvents.value = { ...applicantEvents.value, [candidateId]: events }
    } catch (caught) {
      error.value = errorMessage(caught)
    } finally {
      setEventsLoading(candidateId, false)
    }
  }

  async function loadNotes(candidateId: string): Promise<void> {
    const candidate = applicants.candidateById(candidateId)

    if (!candidate) {
      return
    }

    setNotesLoading(candidateId, true)

    try {
      const notes = await api.fetchApplicantNotes(candidate.boardId, candidateId)
      applicantNotes.value = { ...applicantNotes.value, [candidateId]: notes }
    } catch (caught) {
      error.value = errorMessage(caught)
    } finally {
      setNotesLoading(candidateId, false)
    }
  }

  async function addNote(candidateId: string, body: string): Promise<boolean> {
    error.value = null
    const candidate = applicants.candidateById(candidateId)
    const trimmed = body.trim()

    if (!candidate || !trimmed) {
      return false
    }

    try {
      const note = await api.createApplicantNote({
        boardId: candidate.boardId,
        applicantId: candidateId,
        authorName: auth.actorName,
        body: trimmed,
      })

      applicantNotes.value = {
        ...applicantNotes.value,
        [candidateId]: [note, ...notesFor(candidateId)],
      }
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
    }
  }

  async function recordEdit(candidateId: string): Promise<void> {
    try {
      await api.recordApplicantEditEvent(candidateId)
      await loadEvents(candidateId)
    } catch (caught) {
      error.value = errorMessage(caught)
    }
  }

  function reset(): void {
    applicantEvents.value = {}
    applicantEventsLoading.value = {}
    applicantNotes.value = {}
    applicantNotesLoading.value = {}
    error.value = null
  }

  return {
    error,
    eventsFor,
    eventsLoadingFor,
    notesFor,
    notesLoadingFor,
    loadEvents,
    loadNotes,
    addNote,
    recordEdit,
    forgetCandidate,
    forgetCandidates,
    reset,
  }
})
