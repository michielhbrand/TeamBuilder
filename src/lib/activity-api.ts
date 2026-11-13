import { supabase } from '@/lib/supabase'
import {
  APPLICANT_EVENT_SELECT,
  APPLICANT_NOTE_SELECT,
  fail,
  mapApplicantEvent,
  mapApplicantNote,
} from '@/lib/api-shared'
import type { ApplicantEventRow, ApplicantNoteRow } from '@/lib/api-shared'
import type { ApplicantEvent, ApplicantNote } from '@/types/pipeline'

export async function fetchApplicantEvents(
  boardId: string,
  applicantId: string,
): Promise<ApplicantEvent[]> {
  const { data, error } = await supabase
    .from('applicant_events')
    .select(APPLICANT_EVENT_SELECT)
    .eq('board_id', boardId)
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false })

  fail(error)

  return ((data ?? []) as unknown as ApplicantEventRow[]).map(mapApplicantEvent)
}

export async function recordApplicantEditEvent(applicantId: string): Promise<void> {
  const { error } = await supabase.rpc('record_applicant_edit_event', {
    p_applicant_id: applicantId,
  })

  fail(error)
}

export async function fetchApplicantNotes(
  boardId: string,
  applicantId: string,
): Promise<ApplicantNote[]> {
  const { data, error } = await supabase
    .from('applicant_notes')
    .select(APPLICANT_NOTE_SELECT)
    .eq('board_id', boardId)
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false })

  fail(error)

  return ((data ?? []) as unknown as ApplicantNoteRow[]).map(mapApplicantNote)
}

export async function createApplicantNote(input: {
  boardId: string
  applicantId: string
  authorName: string
  body: string
}): Promise<ApplicantNote> {
  const { data, error } = await supabase
    .from('applicant_notes')
    .insert({
      board_id: input.boardId,
      applicant_id: input.applicantId,
      author_name: input.authorName,
      body: input.body,
    })
    .select(APPLICANT_NOTE_SELECT)
    .single()

  fail(error)

  if (!data) {
    throw new Error('The note could not be saved.')
  }

  return mapApplicantNote(data as unknown as ApplicantNoteRow)
}
