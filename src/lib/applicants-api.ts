import { supabase } from '@/lib/supabase'
import { APPLICANT_SELECT, applicantPatch, fail, mapApplicant } from '@/lib/api-shared'
import type { ApplicantPatch, ApplicantRow } from '@/lib/api-shared'
import { serializeEntries } from '@/lib/career'
import type { CareerEntry, Candidate } from '@/types/pipeline'

export type { ApplicantPatch } from '@/lib/api-shared'

export async function createApplicant(
  boardId: string,
  columnId: string,
  input: {
    name: string
    email: string
    phone: string
    currentRole: string
    education: CareerEntry[]
    experience: CareerEntry[]
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
      education: serializeEntries(input.education),
      experience: serializeEntries(input.experience),
    })
    .select(APPLICANT_SELECT)
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
