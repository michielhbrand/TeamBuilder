import { supabase } from '@/lib/supabase'
import { fail } from '@/lib/api-shared'
import type { HireRecord, HiringMonth } from '@/types/history'

export interface HiringMonthRow {
  month: string
  department: string
  applicants_in: number
  hired: number
  rejected: number
}

export interface HireRecordRow {
  applicant_id: string
  department: string
  hired_on: string
  days_to_hire: number
}

export function mapHiringMonth(row: HiringMonthRow): HiringMonth {
  return {
    month: row.month,
    department: row.department,
    applicantsIn: Number(row.applicants_in),
    hired: Number(row.hired),
    rejected: Number(row.rejected),
  }
}

export function mapHireRecord(row: HireRecordRow): HireRecord {
  return {
    applicantId: row.applicant_id,
    department: row.department,
    hiredOn: row.hired_on,
    daysToHire: Number(row.days_to_hire),
  }
}

export async function fetchHiringMonthly(): Promise<HiringMonth[]> {
  const { data, error } = await supabase
    .from('hiring_monthly')
    .select('month, department, applicants_in, hired, rejected')
    .order('month', { ascending: true })

  fail(error)

  return ((data ?? []) as unknown as HiringMonthRow[]).map(mapHiringMonth)
}

export async function fetchHireHistory(): Promise<HireRecord[]> {
  const { data, error } = await supabase
    .from('hire_history')
    .select('applicant_id, department, hired_on, days_to_hire')
    .order('hired_on', { ascending: true })

  fail(error)

  return ((data ?? []) as unknown as HireRecordRow[]).map(mapHireRecord)
}
