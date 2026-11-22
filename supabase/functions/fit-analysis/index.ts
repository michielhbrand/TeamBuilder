import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  ASSESSMENT_SYSTEM_PROMPT,
  buildAssessmentPrompt,
  validateAssessmentResult,
} from './assess.ts'
import { formatCareerEntries } from './career.ts'
import { callKilo, HttpError, resolveFreeModel } from './kilo.ts'
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from './prompt.ts'
import { prepareCandidateText, prepareJobSpecText } from './redact.ts'
import {
  buildRequirementExtractionPrompt,
  normalizeStoredRequirementSet,
  requirementSetSize,
  REQUIREMENT_EXTRACTION_SYSTEM_PROMPT,
  toRequirementSet,
  validateRequirementExtraction,
  type RequirementSet,
} from './requirements.ts'
import { ModelResultError, validateModelResult } from './validate.ts'

const ALLOWED_ORIGINS = new Set([
  'https://michielhbrand.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
])

interface ApplicantRow {
  id: string
  board_id: string
  full_name: string
  email: string
  phone: string
  education: unknown
  experience: unknown
  skills: unknown
  boards: { name: string; department: string } | { name: string; department: string }[] | null
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }

  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function isFingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8,128}$/i.test(value)
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function profileFingerprint(
  education: string,
  experience: string,
  skills: string[],
): Promise<string> {
  return sha256Text(
    `${education.trim()}\n\n${experience.trim()}\n\n${skills
      .map((skill) => skill.trim())
      .filter(Boolean)
      .join(', ')}`,
  )
}

function candidateSkills(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 80))
    .filter((item) => {
      const key = item.toLowerCase()

      if (!item || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .slice(0, 60)
}

function boardDetails(row: ApplicantRow): { name: string; department: string } {
  const board = Array.isArray(row.boards) ? row.boards[0] : row.boards

  return {
    name: board?.name?.trim() || 'this role',
    department: board?.department?.trim() || 'Unassigned',
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }

  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed.' }, 405)
  }

  try {
    if (Deno.env.get('FIT_ANALYSIS_ENABLED')?.trim().toLowerCase() === 'false') {
      throw new HttpError(503, 'Fit analysis is disabled.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const kiloApiKey = Deno.env.get('KILO_API_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new HttpError(503, 'Fit analysis is not configured.')
    }

    if (!kiloApiKey) {
      throw new HttpError(503, 'Kilo is not configured. Ask an administrator to set KILO_API_KEY.')
    }

    const model = resolveFreeModel(Deno.env.get('KILO_MODEL'))
    const authHeader = request.headers.get('Authorization')

    if (!authHeader) {
      throw new HttpError(401, 'Sign in to analyze applicants.')
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      throw new HttpError(401, 'Sign in to analyze applicants.')
    }

    let body: Record<string, unknown>

    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      throw new HttpError(400, 'The request body must be JSON.')
    }

    const applicantId = body.applicantId

    if (!isUuid(applicantId)) {
      throw new HttpError(400, 'A valid applicant is required.')
    }

    const jobSpecText =
      typeof body.jobSpecText === 'string' ? prepareJobSpecText(body.jobSpecText) : ''
    const jobSpecFingerprint = body.jobSpecFingerprint
    const cvFingerprint = body.cvFingerprint

    if (jobSpecText.length < 40) {
      throw new HttpError(400, 'The job spec does not contain enough readable text.')
    }

    if (!isFingerprint(jobSpecFingerprint) || !isFingerprint(cvFingerprint)) {
      throw new HttpError(400, 'The analysis fingerprints are invalid.')
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: applicant, error: applicantError } = await admin
      .from('applicants')
      .select(
        'id, board_id, full_name, email, phone, education, experience, skills, boards!inner(name, department)',
      )
      .eq('id', applicantId)
      .maybeSingle<ApplicantRow>()

    if (applicantError) {
      throw new HttpError(500, 'The applicant could not be loaded.')
    }

    if (!applicant) {
      throw new HttpError(404, 'The applicant could not be found.')
    }

    const educationText = formatCareerEntries(applicant.education)
    const experienceText = formatCareerEntries(applicant.experience)
    const skills = candidateSkills(applicant.skills)
    const candidateText = prepareCandidateText(educationText, experienceText, skills, {
      full_name: applicant.full_name ?? '',
      email: applicant.email ?? '',
      phone: applicant.phone ?? '',
    })

    if (candidateText.replace(/\s/g, '').length < 40) {
      throw new HttpError(400, 'Add education or work experience before comparing this applicant.')
    }

    const role = boardDetails(applicant)
    let requirementSet: RequirementSet = { minimum: [], recommended: [], skills: [] }
    const { data: storedSet, error: storedSetError } = await admin
      .from('board_requirement_sets')
      .select('requirements')
      .eq('board_id', applicant.board_id)
      .eq('job_spec_fingerprint', jobSpecFingerprint)
      .maybeSingle()

    if (storedSetError) {
      throw new HttpError(500, 'The job requirements could not be loaded.')
    }

    if (storedSet) {
      requirementSet = normalizeStoredRequirementSet(storedSet.requirements)
    } else {
      const extractionMessages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: REQUIREMENT_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildRequirementExtractionPrompt(jobSpecText) },
      ]
      let extractionContent = await callKilo(kiloApiKey, model, extractionMessages, true)
      let extracted: ReturnType<typeof validateRequirementExtraction>

      try {
        extracted = validateRequirementExtraction(extractionContent)
      } catch (caught) {
        if (!(caught instanceof ModelResultError)) {
          throw caught
        }

        extractionContent = await callKilo(kiloApiKey, model, extractionMessages, true)
        extracted = validateRequirementExtraction(extractionContent)
      }

      requirementSet = toRequirementSet(extracted)

      if (requirementSetSize(requirementSet) > 0) {
        const { error: setSaveError } = await admin.from('board_requirement_sets').upsert(
          {
            board_id: applicant.board_id,
            job_spec_fingerprint: jobSpecFingerprint,
            requirements: requirementSet,
          },
          { onConflict: 'board_id,job_spec_fingerprint', ignoreDuplicates: true },
        )

        if (setSaveError) {
          throw new HttpError(500, 'The job requirements could not be saved.')
        }

        const { data: canonicalSet, error: canonicalSetError } = await admin
          .from('board_requirement_sets')
          .select('requirements')
          .eq('board_id', applicant.board_id)
          .eq('job_spec_fingerprint', jobSpecFingerprint)
          .maybeSingle()

        if (canonicalSetError) {
          throw new HttpError(500, 'The job requirements could not be loaded.')
        }

        if (canonicalSet) {
          requirementSet = normalizeStoredRequirementSet(canonicalSet.requirements)
        }
      }
    }

    let result: {
      schemaVersion: number
      complete: boolean
      requirements: unknown
      similarities: string[]
      gaps: string[]
    }

    if (requirementSetSize(requirementSet) > 0) {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: ASSESSMENT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildAssessmentPrompt({
            boardName: role.name,
            department: role.department,
            requirementSet,
            candidateText,
          }),
        },
      ]

      let content = await callKilo(kiloApiKey, model, messages, true)
      let assessment: ReturnType<typeof validateAssessmentResult>

      try {
        assessment = validateAssessmentResult(content, requirementSet)
      } catch (caught) {
        if (!(caught instanceof ModelResultError)) {
          throw caught
        }

        content = await callKilo(kiloApiKey, model, messages, true)
        assessment = validateAssessmentResult(content, requirementSet)
      }

      result = {
        schemaVersion: 3,
        complete: assessment.complete,
        requirements: assessment.requirements,
        similarities: assessment.similarities,
        gaps: assessment.gaps,
      }
    } else {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildUserPrompt({
            boardName: role.name,
            department: role.department,
            jobSpecText,
            candidateText,
          }),
        },
      ]

      let content = await callKilo(kiloApiKey, model, messages, true)
      let validated: ReturnType<typeof validateModelResult>

      try {
        validated = validateModelResult(content)
      } catch (caught) {
        if (!(caught instanceof ModelResultError)) {
          throw caught
        }

        content = await callKilo(kiloApiKey, model, messages, true)
        validated = validateModelResult(content)
      }

      result = {
        schemaVersion: 3,
        complete: true,
        requirements: requirementSet,
        similarities: validated.similarities,
        gaps: validated.gaps,
      }
    }

    const profileHash = await profileFingerprint(educationText, experienceText, skills)
    const { data: saved, error: saveError } = await admin
      .from('applicant_fit_analyses')
      .upsert(
        {
          board_id: applicant.board_id,
          applicant_id: applicant.id,
          cv_fingerprint: cvFingerprint,
          job_spec_fingerprint: jobSpecFingerprint,
          profile_fingerprint: profileHash,
          provider: 'kilo',
          model,
          prompt_version: PROMPT_VERSION,
          result,
          created_by: user.id,
        },
        { onConflict: 'board_id,applicant_id' },
      )
      .select(
        'id, board_id, applicant_id, cv_fingerprint, job_spec_fingerprint, profile_fingerprint, provider, model, prompt_version, result, created_at, updated_at',
      )
      .single()

    if (saveError || !saved) {
      throw new HttpError(500, 'The fit analysis could not be saved.')
    }

    const fullName =
      typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
    const actorName = fullName || user.email?.trim() || 'A teammate'
    const { error: eventError } = await admin.from('applicant_events').insert({
      board_id: applicant.board_id,
      applicant_id: applicant.id,
      actor_id: user.id,
      actor_name: actorName,
      action: 'analyzed',
      message: `${actorName} has analyzed ${applicant.full_name}'s CV against the job spec`,
    })

    if (eventError) {
      console.error('The analyzed applicant event could not be recorded', eventError.message)
    }

    return json(request, saved)
  } catch (caught) {
    if (caught instanceof HttpError) {
      return json(request, { error: caught.message }, caught.status)
    }

    console.error('fit-analysis failed', caught instanceof Error ? caught.name : 'unknown')

    return json(request, { error: 'The fit analysis could not be completed.' }, 500)
  }
})
