import type { FitWeights } from '@/types/fit'

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

export type CareerKind = 'education' | 'experience'

export interface CareerEntry {
  id: string
  title: string
  organization: string
  start: string
  end: string
  current: boolean
  description: string
}

export interface Candidate {
  id: string
  boardId: string
  name: string
  email: string
  phone: string
  currentRole: string
  remChannel: string
  salaryBand: string
  noticePeriodMonths: number
  salaryExpectationCents: number
  favorite: boolean
  stepId: string
  status: CandidateStatus
  appliedAt: string
  stepEnteredAt: string
  education: CareerEntry[]
  experience: CareerEntry[]
  skills: string[]
  cvPath?: string | null
  cvName?: string | null
}

export interface Board {
  id: string
  name: string
  department: Department
  openPositions: number
  deadline: string
  openedAt: string
  steps: PipelineStep[]
  candidates: Candidate[]
  jobSpecPath?: string | null
  jobSpecName?: string | null
  fitWeights?: FitWeights
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
  fitWeights?: FitWeights
}

export interface ApplicantInput {
  name: string
  email: string
  phone: string
  currentRole?: string
  education?: CareerEntry[]
  experience?: CareerEntry[]
  skills?: string[]
  stepId?: string
}

export type ApplicantEventAction =
  'created' | 'moved' | 'edited' | 'hired' | 'rejected' | 'reopened' | 'analyzed'

export interface ApplicantEvent {
  id: string
  boardId: string
  applicantId: string
  actorName: string
  action: ApplicantEventAction
  message: string
  createdAt: string
}

export interface ApplicantNote {
  id: string
  boardId: string
  applicantId: string
  authorName: string
  body: string
  createdAt: string
}
