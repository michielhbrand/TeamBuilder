import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/lib/storage-api'
import { updateApplicant } from '@/lib/applicants-api'
import { errorMessage } from '@/lib/store-errors'
import { useApplicantsStore } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'

export const useStorageStore = defineStore('storage', () => {
  const boards = useBoardsStore()
  const applicants = useApplicantsStore()
  const error = ref<string | null>(null)

  async function removeCvObjectsQuietly(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await api.deleteApplicantCv(path)
      } catch {
        // The applicant is already deleted; a missing object is not actionable here.
      }
    }
  }

  async function removeJobSpecQuietly(path: string | null): Promise<void> {
    if (!path) {
      return
    }

    try {
      await api.deleteBoardJobSpec(path)
    } catch {
      // The board is already deleted; a missing object is not actionable here.
    }
  }

  async function uploadCv(candidateId: string, file: File): Promise<boolean> {
    error.value = null
    const candidate = applicants.candidateById(candidateId)

    if (!candidate) {
      return false
    }

    try {
      const previousPath = candidate.cvPath ?? null
      const uploaded = await api.uploadApplicantCv(candidateId, file)

      if (previousPath && previousPath !== uploaded.path) {
        await removeCvObjectsQuietly([previousPath])
      }

      candidate.cvPath = uploaded.path
      candidate.cvName = uploaded.name
      await updateApplicant(candidateId, {
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
    const candidate = applicants.candidateById(candidateId)
    const path = candidate?.cvPath

    if (!candidate || !path) {
      return false
    }

    try {
      await api.deleteApplicantCv(path)
      candidate.cvPath = null
      candidate.cvName = null
      await updateApplicant(candidateId, { cvPath: null, cvName: null })
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
    const board = boards.boardById(boardId)

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
    const board = boards.boardById(boardId)
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

  function reset(): void {
    error.value = null
  }

  return {
    error,
    removeCvObjectsQuietly,
    removeJobSpecQuietly,
    uploadCv,
    removeCv,
    cvSignedUrl,
    cvBlob,
    uploadJobSpec,
    removeJobSpec,
    jobSpecSignedUrl,
    jobSpecBlob,
    reset,
  }
})
