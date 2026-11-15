import { supabase } from '@/lib/supabase'
import { fail } from '@/lib/api-shared'
import { historyWindowStart } from '@/lib/overview'
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

export const PAGE_SIZE = 1000

type PageResult = PromiseLike<{ data: unknown; error: { message: string } | null }>

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PageResult,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)

    fail(error)

    const batch = (data ?? []) as T[]
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) {
      return rows
    }
  }
}

export async function fetchHiringMonthly(): Promise<HiringMonth[]> {
  const rows = await fetchAllPages<HiringMonthRow>((from, to) =>
    supabase
      .from('hiring_monthly')
      .select('month, department, applicants_in, hired, rejected')
      .order('month', { ascending: true })
      .order('department', { ascending: true })
      .range(from, to),
  )

  return rows.map(mapHiringMonth)
}

export async function fetchHireHistory(now: Date = new Date()): Promise<HireRecord[]> {
  const rows = await fetchAllPages<HireRecordRow>((from, to) =>
    supabase
      .from('hire_history')
      .select('applicant_id, department, hired_on, days_to_hire')
      .gte('hired_on', historyWindowStart(now))
      .order('hired_on', { ascending: false })
      .order('applicant_id', { ascending: true })
      .range(from, to),
  )

  return rows.map(mapHireRecord).reverse()
}
