import { ref } from 'vue'
import { defineStore } from 'pinia'
import { hasCareerContent } from '@/lib/career'
import * as api from '@/lib/fit-api'
import { profileFingerprint, sha256Bytes, sha256Text } from '@/lib/fit-hash'
import {
  fitSummary,
  isRankable,
  rankFitAnalyses,
  type FitRankEntry,
  type FitSummary,
} from '@/lib/fit-rank'
import { friendlyError } from '@/lib/fit-errors'
import { extractJobSpecText } from '@/lib/job-spec'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useApplicantsStore } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import { useStorageStore } from '@/stores/storage'
import type { FitAnalysis } from '@/types/fit'

export const useFitStore = defineStore('fit', () => {
  const boards = useBoardsStore()
  const applicants = useApplicantsStore()
  const activity = useApplicantActivityStore()
  const storage = useStorageStore()
  const analyses = ref<Record<string, FitAnalysis>>({})
  const loaded = ref<Record<string, boolean>>({})
  const loading = ref<Record<string, boolean>>({})
  const analyzing = ref<Record<string, boolean>>({})
  const errors = ref<Record<string, string | null>>({})
  const progress = ref<Record<string, string>>({})
  const profileStale = ref<Record<string, boolean>>({})
  const stale = ref<Record<string, boolean>>({})
  const boardLoaded = ref<Record<string, boolean>>({})
  const boardLoading = ref<Record<string, boolean>>({})
  const boardErrors = ref<Record<string, string | null>>({})

  function analysisFor(applicantId: string): FitAnalysis | undefined {
    return analyses.value[applicantId]
  }

  function isLoadingFor(applicantId: string): boolean {
    return Boolean(loading.value[applicantId])
  }

  function isAnalyzingFor(applicantId: string): boolean {
    return Boolean(analyzing.value[applicantId])
  }

  function errorFor(applicantId: string): string | null {
    return errors.value[applicantId] ?? null
  }

  function progressFor(applicantId: string): string {
    return progress.value[applicantId] ?? ''
  }

  function isProfileStaleFor(applicantId: string): boolean {
    return Boolean(profileStale.value[applicantId])
  }

  function isStaleFor(applicantId: string): boolean {
    const analysis = analyses.value[applicantId]
    const schemaStale = Boolean(analysis && analysis.result.schemaVersion < 3)

    return Boolean(profileStale.value[applicantId] || stale.value[applicantId] || schemaStale)
  }

  function summaryFor(applicantId: string): FitSummary | undefined {
    const analysis = analyses.value[applicantId]

    return analysis ? fitSummary(analysis.result) : undefined
  }

  function isRankableFor(applicantId: string): boolean {
    return isRankable(analyses.value[applicantId])
  }

  function rankForStage(boardId: string, stepId: string): Map<string, FitRankEntry> {
    const board = boards.boardById(boardId)

    if (!board) {
      return new Map()
    }

    const analysesInStage = board.candidates
      .filter((candidate) => candidate.status === 'active' && candidate.stepId === stepId)
      .map((candidate) => analyses.value[candidate.id])
      .filter((analysis): analysis is FitAnalysis => Boolean(analysis))

    return rankFitAnalyses(analysesInStage)
  }

  function boardErrorFor(boardId: string): string | null {
    return boardErrors.value[boardId] ?? null
  }

  function isBoardLoading(boardId: string): boolean {
    return Boolean(boardLoading.value[boardId])
  }

  function markStale(applicantId: string): void {
    stale.value = { ...stale.value, [applicantId]: true }
  }

  function markBoardStale(boardId: string): void {
    const board = boards.boardById(boardId)

    if (!board) {
      return
    }

    const next = { ...stale.value }

    for (const candidate of board.candidates) {
      next[candidate.id] = true
    }

    stale.value = next
  }

  function setLoading(applicantId: string, value: boolean): void {
    loading.value = { ...loading.value, [applicantId]: value }
  }

  function setAnalyzing(applicantId: string, value: boolean): void {
    analyzing.value = { ...analyzing.value, [applicantId]: value }
  }

  function setError(applicantId: string, value: string | null): void {
    errors.value = { ...errors.value, [applicantId]: value }
  }

  function setProgress(applicantId: string, value: string): void {
    progress.value = { ...progress.value, [applicantId]: value }
  }

  async function updateProfileStale(applicantId: string): Promise<void> {
    const candidate = applicants.candidateById(applicantId)
    const analysis = analyses.value[applicantId]

    if (!candidate || !analysis) {
      profileStale.value = { ...profileStale.value, [applicantId]: false }
      return
    }

    const fingerprint = await profileFingerprint(
      candidate.education,
      candidate.experience,
      candidate.skills,
    )
    profileStale.value = {
      ...profileStale.value,
      [applicantId]: fingerprint !== analysis.profileFingerprint,
    }
  }

  async function load(applicantId: string): Promise<FitAnalysis | undefined> {
    if (loaded.value[applicantId] || loading.value[applicantId]) {
      return analyses.value[applicantId]
    }

    const candidate = applicants.candidateById(applicantId)

    if (!candidate) {
      return undefined
    }

    setError(applicantId, null)
    setLoading(applicantId, true)

    try {
      const analysis = await api.fetchApplicantFitAnalysis(candidate.boardId, applicantId)

      if (analysis) {
        analyses.value = { ...analyses.value, [applicantId]: analysis }
        await updateProfileStale(applicantId)
      }

      loaded.value = { ...loaded.value, [applicantId]: true }
      return analysis
    } catch (caught) {
      setError(
        applicantId,
        friendlyError(
          caught instanceof Error ? caught.message : 'The fit analysis could not be loaded.',
        ),
      )
      return undefined
    } finally {
      setLoading(applicantId, false)
    }
  }

  async function loadBoard(boardId: string): Promise<void> {
    if (boardLoading.value[boardId]) {
      return
    }

    boardLoading.value = { ...boardLoading.value, [boardId]: true }
    boardErrors.value = { ...boardErrors.value, [boardId]: null }

    try {
      const items = await api.fetchBoardFitAnalyses(boardId)
      const nextAnalyses = { ...analyses.value }
      const nextLoaded = { ...loaded.value }

      for (const analysis of items) {
        nextAnalyses[analysis.applicantId] = analysis
        nextLoaded[analysis.applicantId] = true
      }

      analyses.value = nextAnalyses
      loaded.value = nextLoaded
      boardLoaded.value = { ...boardLoaded.value, [boardId]: true }
      await Promise.all(items.map((analysis) => updateProfileStale(analysis.applicantId)))
    } catch (caught) {
      boardErrors.value = {
        ...boardErrors.value,
        [boardId]: friendlyError(
          caught instanceof Error ? caught.message : 'The fit analyses could not be loaded.',
        ),
      }
    } finally {
      boardLoading.value = { ...boardLoading.value, [boardId]: false }
    }
  }

  async function analyze(
    applicantId: string,
    options: { force?: boolean } = {},
  ): Promise<FitAnalysis | null> {
    if (analyzing.value[applicantId]) {
      return null
    }

    const candidate = applicants.candidateById(applicantId)
    const board = candidate ? boards.boardById(candidate.boardId) : undefined

    if (!candidate || !board) {
      setError(applicantId, 'The applicant could not be found.')
      return null
    }

    if (!candidate.cvPath) {
      setError(applicantId, 'Upload a CV before comparing this applicant.')
      return null
    }

    if (!board.jobSpecPath) {
      setError(applicantId, 'Add a job spec to this board before comparing this applicant.')
      return null
    }

    if (!hasCareerContent(candidate.education, candidate.experience)) {
      setError(applicantId, 'Add education or work experience before comparing this applicant.')
      return null
    }

    const existing = analyses.value[applicantId]

    if (existing && !options.force) {
      await updateProfileStale(applicantId)

      if (!isStaleFor(applicantId)) {
        return existing
      }
    }

    setError(applicantId, null)
    setAnalyzing(applicantId, true)
    setProgress(applicantId, 'Reading the job spec…')

    try {
      const jobSpecBlob = await storage.jobSpecBlob(board.jobSpecPath)

      if (!jobSpecBlob) {
        throw new Error('The job spec could not be downloaded.')
      }

      const jobSpec = await extractJobSpecText(jobSpecBlob, {
        onProgress: (update) => setProgress(applicantId, update.message),
      })

      if (!jobSpec.text.trim()) {
        throw new Error('The job spec does not contain readable text.')
      }

      const cvBlob = await storage.cvBlob(candidate.cvPath)

      if (!cvBlob) {
        throw new Error('The CV could not be downloaded.')
      }

      setProgress(applicantId, 'Preparing the analysis…')
      const cvBytes = new Uint8Array(await cvBlob.arrayBuffer())
      const [cvFingerprint, jobSpecFingerprint, currentProfileFingerprint] = await Promise.all([
        sha256Bytes(cvBytes),
        sha256Text(jobSpec.text),
        profileFingerprint(candidate.education, candidate.experience, candidate.skills),
      ])

      setProgress(applicantId, 'Waiting for the free model…')
      const analysis = await api.analyzeApplicantFit({
        applicantId,
        jobSpecText: jobSpec.text,
        jobSpecFingerprint,
        cvFingerprint,
        ocrUsed: jobSpec.ocrUsed,
      })

      await activity.loadEvents(applicantId)
      analyses.value = { ...analyses.value, [applicantId]: analysis }
      loaded.value = { ...loaded.value, [applicantId]: true }
      profileStale.value = {
        ...profileStale.value,
        [applicantId]: currentProfileFingerprint !== analysis.profileFingerprint,
      }
      stale.value = { ...stale.value, [applicantId]: false }
      setProgress(applicantId, '')
      return analysis
    } catch (caught) {
      setProgress(applicantId, '')
      setError(
        applicantId,
        friendlyError(
          caught instanceof Error ? caught.message : 'The fit analysis could not be completed.',
        ),
      )
      return null
    } finally {
      setAnalyzing(applicantId, false)
    }
  }

  function reset(): void {
    analyses.value = {}
    loaded.value = {}
    loading.value = {}
    analyzing.value = {}
    errors.value = {}
    progress.value = {}
    profileStale.value = {}
    stale.value = {}
    boardLoaded.value = {}
    boardLoading.value = {}
    boardErrors.value = {}
  }

  return {
    analyses,
    loaded,
    loading,
    analyzing,
    errors,
    progress,
    profileStale,
    stale,
    boardLoaded,
    boardLoading,
    boardErrors,
    analysisFor,
    isLoadingFor,
    isAnalyzingFor,
    errorFor,
    progressFor,
    isProfileStaleFor,
    isStaleFor,
    summaryFor,
    isRankableFor,
    rankForStage,
    boardErrorFor,
    isBoardLoading,
    markStale,
    markBoardStale,
    refreshProfileStale: updateProfileStale,
    load,
    loadBoard,
    analyze,
    reset,
  }
})
