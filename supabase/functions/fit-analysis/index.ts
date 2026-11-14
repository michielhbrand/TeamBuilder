import { createClient } from 'jsr:@supabase/supabase-js@2'
import { formatCareerEntries } from './career.ts'
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from './prompt.ts'
import { prepareCandidateText, prepareJobSpecText } from './redact.ts'
import { ModelResultError, validateModelResult } from './validate.ts'

const KILO_BASE_URL = 'https://ai-gateway.kilo.ai/api/v1'
const REQUEST_TIMEOUT_MS = 120_000
const KILO_MAX_TOKENS = 8192

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
  boards: { name: string; department: string } | { name: string; department: string }[] | null
}

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

interface KiloChoice {
  finish_reason?: string
  message?: { content?: unknown }
}

interface KiloPayload {
  model?: string
  choices?: KiloChoice[]
  usage?: {
    completion_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
  }
}

function kiloText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((part) => {
      if (!part || typeof part !== 'object' || !('text' in part)) {
        return ''
      }

      const text = (part as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('')
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

function profileFingerprint(education: string, experience: string): Promise<string> {
  return sha256Text(`${education.trim()}\n\n${experience.trim()}`)
}

function boardDetails(row: ApplicantRow): { name: string; department: string } {
  const board = Array.isArray(row.boards) ? row.boards[0] : row.boards

  return {
    name: board?.name?.trim() || 'this role',
    department: board?.department?.trim() || 'Unassigned',
  }
}

function freeModel(): string {
  const model = Deno.env.get('KILO_MODEL')?.trim() ?? ''

  if (!model) {
    throw new HttpError(503, 'Kilo is not configured. Set KILO_MODEL.')
  }

  if (model !== 'kilo-auto/free' && !model.endsWith(':free')) {
    throw new HttpError(503, 'Kilo is not configured with a free model.')
  }

  return model
}

async function callKilo(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  jsonMode: boolean,
): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${KILO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_tokens: KILO_MAX_TOKENS,
        reasoning: { enabled: false },
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 400 && jsonMode) {
        return callKilo(apiKey, model, messages, false)
      }

      if (response.status === 401 || response.status === 403) {
        throw new HttpError(502, 'Kilo rejected the API key. Ask an administrator to check it.')
      }

      if (response.status === 429) {
        throw new HttpError(429, 'The free model is rate-limited right now. Try again later.')
      }

      throw new HttpError(502, `Kilo returned status ${response.status}. Try again later.`)
    }

    const payload = (await response.json()) as KiloPayload
    const choice = payload.choices?.[0]
    const content = kiloText(choice?.message?.content)

    if (!content.trim()) {
      console.error('Kilo returned no analysis text', {
        model: payload.model ?? model,
        finishReason: choice?.finish_reason ?? null,
        contentType: Array.isArray(choice?.message?.content)
          ? 'array'
          : typeof choice?.message?.content,
        completionTokens: payload.usage?.completion_tokens ?? null,
        reasoningTokens: payload.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      })

      if (choice?.finish_reason === 'length') {
        throw new HttpError(
          502,
          'The free model ran out of output tokens before returning an analysis. Try again or use a non-reasoning free model.',
        )
      }

      throw new HttpError(502, 'Kilo did not return an analysis. Try again later.')
    }

    return content
  } catch (caught) {
    if (caught instanceof HttpError) {
      throw caught
    }

    if (caught instanceof DOMException && caught.name === 'AbortError') {
      throw new HttpError(504, 'Kilo took too long to respond. Try again later.')
    }

    throw new HttpError(502, 'Kilo could not be reached. Try again later.')
  } finally {
    clearTimeout(timeout)
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

    const model = freeModel()
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
        'id, board_id, full_name, email, phone, education, experience, boards!inner(name, department)',
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
    const candidateText = prepareCandidateText(educationText, experienceText, {
      full_name: applicant.full_name ?? '',
      email: applicant.email ?? '',
      phone: applicant.phone ?? '',
    })

    if (candidateText.replace(/\s/g, '').length < 40) {
      throw new HttpError(400, 'Add education or work experience before comparing this applicant.')
    }

    const role = boardDetails(applicant)
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

    const profileHash = await profileFingerprint(educationText, experienceText)
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
          result: validated,
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
