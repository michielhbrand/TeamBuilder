export type FitRequirementKind = 'minimum' | 'recommended' | 'skill'

export type FitRequirementStatus = 'full' | 'partial' | 'none'

export interface FitRequirementAssessment {
  id: string
  kind: FitRequirementKind
  label: string
  status: FitRequirementStatus
  evidence: string
  assessed: boolean
}

export interface FitRequirementGroups {
  minimum: FitRequirementAssessment[]
  recommended: FitRequirementAssessment[]
  skills: FitRequirementAssessment[]
}

export interface FitAnalysisResult {
  schemaVersion: number
  complete: boolean
  requirements: FitRequirementGroups
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
