import type {
  ApplicantEvent,
  ApplicantEventAction,
  ApplicantNote,
  Board,
  BoardInput,
  Candidate,
  CandidateStatus,
  Department,
  PipelineStep,
} from '@/types/pipeline'
import type { FitAnalysis, FitAnalysisResult, FitAnalysisRow } from '@/types/fit'

export interface BoardRow {
  id: string
  name: string
  department: string
  open_positions: number
  deadline: string
  job_spec_path: string | null
  job_spec_name: string | null
  board_columns: ColumnRow[] | null
  applicants: ApplicantRow[] | null
}

export interface ColumnRow {
  id: string
  board_id: string
  name: string
  position: number
}

export interface ApplicantRow {
  id: string
  board_id: string
  column_id: string
  full_name: string
  email: string
  phone: string
  job_title: string
  education: string
  experience: string
  favorite: boolean
  status: string
  applied_at: string
  step_entered_at: string
  cv_path: string | null
  cv_name: string | null
}

export interface ApplicantEventRow {
  id: string
  board_id: string
  applicant_id: string
  actor_name: string
  action: string
  message: string
  created_at: string
}

export interface ApplicantNoteRow {
  id: string
  board_id: string
  applicant_id: string
  author_name: string
  body: string
  created_at: string
}

export interface ApplicantPatch {
  name?: string
  email?: string
  phone?: string
  currentRole?: string
  education?: string
  experience?: string
  favorite?: boolean
  status?: CandidateStatus
  columnId?: string
  stepEnteredAt?: string
  cvPath?: string | null
  cvName?: string | null
}

export const CV_BUCKET = 'cvs'
export const JOB_SPEC_BUCKET = 'job-specs'

export const APPLICANT_EVENT_SELECT = `
  id,
  board_id,
  applicant_id,
  actor_name,
  action,
  message,
  created_at
`

export const APPLICANT_NOTE_SELECT = `
  id,
  board_id,
  applicant_id,
  author_name,
  body,
  created_at
`

export const FIT_ANALYSIS_SELECT = `
  id,
  board_id,
  applicant_id,
  cv_fingerprint,
  job_spec_fingerprint,
  profile_fingerprint,
  provider,
  model,
  prompt_version,
  result,
  created_at,
  updated_at
`

export const APPLICANT_SELECT = `
  id,
  board_id,
  column_id,
  full_name,
  email,
  phone,
  job_title,
  education,
  experience,
  favorite,
  status,
  applied_at,
  step_entered_at,
  cv_path,
  cv_name
`

export const BOARD_SELECT = `
  id,
  name,
  department,
  open_positions,
  deadline,
  job_spec_path,
  job_spec_name,
  board_columns ( id, board_id, name, position ),
  applicants (
    id,
    board_id,
    column_id,
    full_name,
    email,
    phone,
    job_title,
    education,
    experience,
    favorite,
    status,
    applied_at,
    step_entered_at,
    cv_path,
    cv_name
  )
`

export function fail(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message)
  }
}

export function mapColumn(row: ColumnRow): PipelineStep {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
  }
}

export function mapApplicant(row: ApplicantRow): Candidate {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    currentRole: row.job_title,
    favorite: row.favorite,
    stepId: row.column_id,
    status: row.status as CandidateStatus,
    appliedAt: row.applied_at,
    stepEnteredAt: row.step_entered_at,
    education: row.education,
    experience: row.experience,
    cvPath: row.cv_path,
    cvName: row.cv_name,
  }
}

export function mapApplicantEvent(row: ApplicantEventRow): ApplicantEvent {
  return {
    id: row.id,
    boardId: row.board_id,
    applicantId: row.applicant_id,
    actorName: row.actor_name,
    action: row.action as ApplicantEventAction,
    message: row.message,
    createdAt: row.created_at,
  }
}

export function mapApplicantNote(row: ApplicantNoteRow): ApplicantNote {
  return {
    id: row.id,
    boardId: row.board_id,
    applicantId: row.applicant_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  }
}

function normalizeFitResult(value: FitAnalysisResult): FitAnalysisResult {
  const result = value as unknown as {
    schemaVersion?: unknown
    similarities?: unknown
    strengths?: unknown
    gaps?: unknown
  }
  const strings = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : []
  const similarities = strings(result.similarities ?? result.strengths)

  return {
    schemaVersion: typeof result.schemaVersion === 'number' ? result.schemaVersion : 1,
    similarities,
    gaps: strings(result.gaps),
  }
}

export function mapFitAnalysis(row: FitAnalysisRow): FitAnalysis {
  return {
    id: row.id,
    boardId: row.board_id,
    applicantId: row.applicant_id,
    cvFingerprint: row.cv_fingerprint,
    jobSpecFingerprint: row.job_spec_fingerprint,
    profileFingerprint: row.profile_fingerprint,
    provider: row.provider,
    model: row.model,
    promptVersion: row.prompt_version,
    result: normalizeFitResult(row.result),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBoard(row: BoardRow): Board {
  const steps = [...(row.board_columns ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(mapColumn)

  const candidates = [...(row.applicants ?? [])].map(mapApplicant)

  return {
    id: row.id,
    name: row.name,
    department: row.department as Department,
    openPositions: row.open_positions,
    deadline: row.deadline,
    steps,
    candidates,
    jobSpecPath: row.job_spec_path,
    jobSpecName: row.job_spec_name,
  }
}

export function boardPatch(input: Partial<BoardInput>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (input.name !== undefined) patch.name = input.name
  if (input.department !== undefined) patch.department = input.department
  if (input.openPositions !== undefined) patch.open_positions = input.openPositions
  if (input.deadline !== undefined) patch.deadline = input.deadline

  return patch
}

export function applicantPatch(input: ApplicantPatch): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (input.name !== undefined) patch.full_name = input.name
  if (input.email !== undefined) patch.email = input.email
  if (input.phone !== undefined) patch.phone = input.phone
  if (input.currentRole !== undefined) patch.job_title = input.currentRole
  if (input.education !== undefined) patch.education = input.education
  if (input.experience !== undefined) patch.experience = input.experience
  if (input.favorite !== undefined) patch.favorite = input.favorite
  if (input.status !== undefined) patch.status = input.status
  if (input.columnId !== undefined) patch.column_id = input.columnId
  if (input.stepEnteredAt !== undefined) patch.step_entered_at = input.stepEnteredAt
  if (input.cvPath !== undefined) patch.cv_path = input.cvPath
  if (input.cvName !== undefined) patch.cv_name = input.cvName

  return patch
}
