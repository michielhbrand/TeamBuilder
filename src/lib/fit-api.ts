import { supabase } from '@/lib/supabase'
import { FIT_ANALYSIS_SELECT, fail, mapFitAnalysis } from '@/lib/api-shared'
import type { FitAnalysis, FitAnalysisRow, FitAnalyzeInput } from '@/types/fit'

export async function fetchApplicantFitAnalysis(
  boardId: string,
  applicantId: string,
): Promise<FitAnalysis | undefined> {
  const { data, error } = await supabase
    .from('applicant_fit_analyses')
    .select(FIT_ANALYSIS_SELECT)
    .eq('board_id', boardId)
    .eq('applicant_id', applicantId)
    .maybeSingle()

  fail(error)

  return data ? mapFitAnalysis(data as unknown as FitAnalysisRow) : undefined
}

export async function analyzeApplicantFit(input: FitAnalyzeInput): Promise<FitAnalysis> {
  const { data, error } = await supabase.functions.invoke('fit-analysis', {
    body: input,
  })

  if (error) {
    const context = (error as { context?: Response }).context
    let message = error.message

    if (context && typeof context.json === 'function') {
      try {
        const body = (await context.json()) as { error?: unknown }

        if (typeof body.error === 'string' && body.error.trim()) {
          message = body.error
        }
      } catch {
        // Keep the original function invocation error.
      }
    }

    throw new Error(message)
  }

  if (!data) {
    throw new Error('The fit analysis did not return a result.')
  }

  return mapFitAnalysis(data as FitAnalysisRow)
}
