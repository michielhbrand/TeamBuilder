export const departments = [
  'Engineering',
  'Design',
  'Analytics',
  'Sales',
  'Operations',
  'Customer success',
  'Marketing',
] as const

export type Department = string

export type CandidateStatus = 'active' | 'hired' | 'rejected'

export interface PipelineStep {
  id: string
  name: string
  position: number
}

export interface Candidate {
  id: string
  boardId: string
  name: string
  email: string
  phone: string
  currentRole: string
  favorite: boolean
  stepId: string
  status: CandidateStatus
  appliedAt: string
  stepEnteredAt: string
  education: string
  experience: string
  cvPath?: string | null
  cvName?: string | null
}

export interface Board {
  id: string
  name: string
  department: Department
  openPositions: number
  deadline: string
  steps: PipelineStep[]
  candidates: Candidate[]
}

export interface StepCount {
  step: PipelineStep
  count: number
}

export interface BoardSummary {
  board: Board
  active: number
  overdue: boolean
  hired: number
  rejected: number
  stepCounts: StepCount[]
  pipelineCounts: number[]
}

export interface BoardGroup {
  department: string
  boards: Board[]
}

export interface PipelineTotals {
  openPositions: number
  active: number
  overdue: number
  hired: number
  rejected: number
}

export interface BoardInput {
  name: string
  department: Department
  openPositions: number
  deadline: string
}

export interface ApplicantInput {
  name: string
  email: string
  phone: string
  currentRole?: string
  education?: string
  experience?: string
  stepId?: string
}
