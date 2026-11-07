import { supabase } from '@/lib/supabase'
import type {
  Board,
  BoardInput,
  Candidate,
  CandidateStatus,
  Department,
  PipelineStep,
} from '@/types/pipeline'

interface BoardRow {
  id: string
  name: string
  department: string
  open_positions: number
  deadline: string
  board_columns: ColumnRow[] | null
  applicants: ApplicantRow[] | null
}

interface ColumnRow {
  id: string
  board_id: string
  name: string
  position: number
}

interface ApplicantRow {
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
const CV_MAX_BYTES = 10 * 1024 * 1024

const BOARD_SELECT = `
  id,
  name,
  department,
  open_positions,
  deadline,
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

function fail(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message)
  }
}

function mapColumn(row: ColumnRow): PipelineStep {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
  }
}

function mapApplicant(row: ApplicantRow): Candidate {
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

function mapBoard(row: BoardRow): Board {
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
  }
}

function boardPatch(input: Partial<BoardInput>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (input.name !== undefined) patch.name = input.name
  if (input.department !== undefined) patch.department = input.department
  if (input.openPositions !== undefined) patch.open_positions = input.openPositions
  if (input.deadline !== undefined) patch.deadline = input.deadline

  return patch
}

function applicantPatch(input: ApplicantPatch): Record<string, unknown> {
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

export async function fetchBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select(BOARD_SELECT)
    .order('name', { ascending: true })

  fail(error)

  return ((data ?? []) as unknown as BoardRow[]).map(mapBoard)
}

export async function fetchBoard(id: string): Promise<Board | undefined> {
  const { data, error } = await supabase
    .from('boards')
    .select(BOARD_SELECT)
    .eq('id', id)
    .maybeSingle()

  fail(error)

  return data ? mapBoard(data as unknown as BoardRow) : undefined
}

export async function createBoard(input: BoardInput): Promise<Board> {
  const { data, error } = await supabase.rpc('create_board', {
    p_name: input.name,
    p_department: input.department,
    p_deadline: input.deadline,
    p_open_positions: input.openPositions,
  })

  fail(error)

  const board = await fetchBoard(String(data))

  if (!board) {
    throw new Error('The board was created but could not be loaded.')
  }

  return board
}

export async function updateBoard(id: string, input: Partial<BoardInput>): Promise<void> {
  const patch = boardPatch(input)

  if (!Object.keys(patch).length) {
    return
  }

  const { error } = await supabase.from('boards').update(patch).eq('id', id)
  fail(error)
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from('boards').delete().eq('id', id)
  fail(error)
}

export async function addBoardColumn(
  boardId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase.rpc('add_board_column', {
    p_board_id: boardId,
    p_name: name,
  })

  fail(error)

  return { id: String(data), name }
}

export async function renameBoardColumn(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('board_columns').update({ name }).eq('id', id)
  fail(error)
}

export async function deleteBoardColumn(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_board_column', { p_column_id: id })
  fail(error)
}

export async function reorderBoardColumns(boardId: string, columnIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_board_columns', {
    p_board_id: boardId,
    p_column_ids: columnIds,
  })

  fail(error)
}

export async function createApplicant(
  boardId: string,
  columnId: string,
  input: {
    name: string
    email: string
    phone: string
    currentRole: string
    education: string
    experience: string
  },
): Promise<Candidate> {
  const { data, error } = await supabase
    .from('applicants')
    .insert({
      board_id: boardId,
      column_id: columnId,
      full_name: input.name,
      email: input.email,
      phone: input.phone,
      job_title: input.currentRole,
      education: input.education,
      experience: input.experience,
    })
    .select(
      'id, board_id, column_id, full_name, email, phone, job_title, education, experience, favorite, status, applied_at, step_entered_at, cv_path, cv_name',
    )
    .single()

  fail(error)

  return mapApplicant(data as unknown as ApplicantRow)
}

export async function updateApplicant(id: string, input: ApplicantPatch): Promise<void> {
  const patch = applicantPatch(input)

  if (!Object.keys(patch).length) {
    return
  }

  const { error } = await supabase.from('applicants').update(patch).eq('id', id)
  fail(error)
}

export async function deleteApplicant(id: string): Promise<void> {
  const { error } = await supabase.from('applicants').delete().eq('id', id)
  fail(error)
}

export function applicantCvPath(id: string): string {
  return `${id}/cv.pdf`
}

export async function uploadApplicantCv(
  id: string,
  file: File,
): Promise<{ path: string; name: string }> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('The CV must be a PDF file.')
  }

  if (file.size > CV_MAX_BYTES) {
    throw new Error('The CV must be smaller than 10 MB.')
  }

  const path = applicantCvPath(id)
  const { error } = await supabase.storage.from(CV_BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: true,
  })

  fail(error)

  return { path, name: file.name }
}

export async function deleteApplicantCv(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CV_BUCKET).remove([path])
  fail(error)
}

export async function createApplicantCvUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(CV_BUCKET).createSignedUrl(path, expiresIn)
  fail(error)

  if (!data?.signedUrl) {
    throw new Error('The CV link could not be created.')
  }

  return data.signedUrl
}

export async function downloadApplicantCv(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(CV_BUCKET).download(path)
  fail(error)

  if (!data) {
    throw new Error('The CV could not be downloaded.')
  }

  return data
}
