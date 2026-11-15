export interface HiringMonth {
  month: string
  department: string
  applicantsIn: number
  hired: number
  rejected: number
}

export interface HireRecord {
  applicantId: string
  department: string
  hiredOn: string
  daysToHire: number
}
