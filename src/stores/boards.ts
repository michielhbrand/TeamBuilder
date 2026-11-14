import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/lib/boards-api'
import { flattenBoards, groupBoards, summariseBoard, summariseBoards } from '@/lib/pipeline'
import { errorMessage } from '@/lib/store-errors'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useApplicantsStore } from '@/stores/applicants'
import { useStorageStore } from '@/stores/storage'
import type { Board, BoardInput, BoardSummary, PipelineStep } from '@/types/pipeline'

export const useBoardsStore = defineStore('boards', () => {
  const boards = ref<Board[]>([])
  const loading = ref(false)
  const refreshing = ref(false)
  const initialized = ref(false)
  const error = ref<string | null>(null)

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

  function applyRemoteBoards(remote: Board[]): void {
    const applicants = useApplicantsStore()
    const next: Board[] = []

    for (const remoteBoard of remote) {
      const local = boardById(remoteBoard.id)

      if (!local) {
        next.push(remoteBoard)
        continue
      }

      local.name = remoteBoard.name
      local.department = remoteBoard.department
      local.openPositions = remoteBoard.openPositions
      local.deadline = remoteBoard.deadline
      local.jobSpecPath = remoteBoard.jobSpecPath
      local.jobSpecName = remoteBoard.jobSpecName
      local.steps = remoteBoard.steps

      const existing = new Map(local.candidates.map((candidate) => [candidate.id, candidate]))
      local.candidates = remoteBoard.candidates.map((remoteCandidate) => {
        const pending = applicants.pendingProfileValues(remoteCandidate.id)
        const candidate = existing.get(remoteCandidate.id)

        if (!candidate) {
          return pending ? { ...remoteCandidate, ...pending } : remoteCandidate
        }

        Object.assign(candidate, remoteCandidate)

        if (pending) {
          Object.assign(candidate, pending)
        }

        return candidate
      })

      next.push(local)
    }

    boards.value = next
  }

  async function refresh(): Promise<void> {
    if (!initialized.value || refreshing.value) {
      return
    }

    refreshing.value = true

    try {
      const remote = await api.fetchBoards()
      applyRemoteBoards(remote)
      error.value = null
    } catch (caught) {
      error.value = errorMessage(caught)
    } finally {
      refreshing.value = false
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
    const candidateIds = board?.candidates.map((candidate) => candidate.id) ?? []

    try {
      await api.deleteBoard(id)
      boards.value = boards.value.filter((item) => item.id !== id)
      useApplicantsStore().forgetCandidates(candidateIds)
      useApplicantActivityStore().forgetCandidates(candidateIds)
      const storage = useStorageStore()
      await storage.removeCvObjectsQuietly(cvPaths)
      await storage.removeJobSpecQuietly(jobSpecPath)
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      return false
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

  function reset(): void {
    boards.value = []
    initialized.value = false
    loading.value = false
    refreshing.value = false
    error.value = null
  }

  return {
    boards,
    loading,
    refreshing,
    initialized,
    error,
    groups,
    orderedBoards,
    summaries,
    totals,
    needsAttention,
    boardById,
    summaryById,
    initialize,
    refresh,
    createBoard,
    updateBoard,
    deleteBoard,
    addColumn,
    renameColumn,
    reorderColumns,
    deleteColumn,
    reset,
  }
})
