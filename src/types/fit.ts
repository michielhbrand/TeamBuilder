export interface FitAnalysisResult {
  schemaVersion: number
  similarities: string[]
  gaps: string[]
}

export interface FitAnalysis {
  id: string
  boardId: string
  applicantId: string
  cvFingerprint: string
  jobSpecFingerprint: string
  profileFingerprint: string
  provider: string
  model: string
  promptVersion: string
  result: FitAnalysisResult
  createdAt: string
  updatedAt: string
}

export interface FitAnalysisRow {
  id: string
  board_id: string
  applicant_id: string
  cv_fingerprint: string
  job_spec_fingerprint: string
  profile_fingerprint: string
  provider: string
  model: string
  prompt_version: string
  result: FitAnalysisResult
  created_at: string
  updated_at: string
}

export interface FitAnalyzeInput {
  applicantId: string
  jobSpecText: string
  jobSpecFingerprint: string
  cvFingerprint: string
  ocrUsed: boolean
}
