import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  callKilo,
  HttpError,
  KILO_MAX_TOKENS,
  resolveFreeModel,
} from '../../supabase/functions/fit-analysis/kilo'
import { ASSESSMENT_SYSTEM_PROMPT } from '../../supabase/functions/fit-analysis/assess'
import {
  prepareCandidateText,
  prepareJobSpecText,
} from '../../supabase/functions/fit-analysis/redact'

const messages = [
  { role: 'system' as const, content: 'system' },
  { role: 'user' as const, content: 'user' },
]

function kiloResponse(content: string, usage: Record<string, unknown> = { completion_tokens: 50 }) {
  return new Response(
    JSON.stringify({
      model: 'kilo-auto/free',
      choices: [{ finish_reason: 'stop', message: { content } }],
      usage,
    }),
    { status: 200 },
  )
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>()

  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response)
  }

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveFreeModel', () => {
  it('requires a configured model', () => {
    expect(() => resolveFreeModel(undefined)).toThrow(HttpError)
    expect(() => resolveFreeModel('  ')).toThrow(/Set KILO_MODEL/)
  })

  it('accepts free models exactly as configured', () => {
    expect(resolveFreeModel('kilo-auto/free')).toBe('kilo-auto/free')
    expect(resolveFreeModel(' vendor/model:free ')).toBe('vendor/model:free')
  })

  it('refuses paid, reasoning, and deep models instead of substituting another', () => {
    expect(() => resolveFreeModel('vendor/paid-model')).toThrow(/free model/)
    expect(() => resolveFreeModel('vendor/reasoning-model:free')).toThrow(/free model/)
    expect(() => resolveFreeModel('vendor/deep-thinker:free')).toThrow(/free model/)
  })
})

describe('callKilo', () => {
  it('explicitly disables reasoning and leaves room for the full answer', async () => {
    const fetchMock = stubFetch(kiloResponse('{"ok":true}'))

    await callKilo('key', 'kilo-auto/free', messages, true)

    const body = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)
    expect(body.reasoning).toEqual({ enabled: false, type: 'none' })
    expect(body.max_tokens).toBe(KILO_MAX_TOKENS)
    expect(KILO_MAX_TOKENS).toBeGreaterThanOrEqual(8192)
    expect(body.model).toBe('kilo-auto/free')
  })

  it('returns analysis text that happens to contain ordinary words', async () => {
    const text = JSON.stringify({
      assessments: [
        { id: 'minimum-1', status: 'full', evidence: 'First-class honours BSc, however part-time' },
        {
          id: 'skill-1',
          status: 'full',
          evidence: 'Critical thinking applied to a TypeScript platform',
        },
      ],
    })
    stubFetch(kiloResponse(text))

    await expect(callKilo('key', 'kilo-auto/free', messages, true)).resolves.toBe(text)
  })

  it('rejects a response that used reasoning tokens', async () => {
    stubFetch(
      kiloResponse('{"ok":true}', {
        completion_tokens: 900,
        completion_tokens_details: { reasoning_tokens: 700 },
      }),
    )

    await expect(callKilo('key', 'kilo-auto/free', messages, true)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('700 reasoning tokens'),
    })
  })

  it('reports rate limiting without trying any other model', async () => {
    const fetchMock = stubFetch(new Response('', { status: 429 }))

    await expect(callKilo('key', 'kilo-auto/free', messages, true)).rejects.toMatchObject({
      status: 429,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries once without json mode when Kilo answers 400', async () => {
    const fetchMock = stubFetch(new Response('', { status: 400 }), kiloResponse('{"ok":true}'))

    await expect(callKilo('key', 'kilo-auto/free', messages, true)).resolves.toBe('{"ok":true}')

    const second = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string)
    expect(second.response_format).toBeUndefined()
  })

  it('explains a truncated answer', async () => {
    stubFetch(
      new Response(
        JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '' } }] }),
        { status: 200 },
      ),
    )

    await expect(callKilo('key', 'kilo-auto/free', messages, true)).rejects.toThrow(
      /ran out of output tokens/,
    )
  })
})

describe('input limits', () => {
  it('lets the server read as much job spec as the browser extracts', () => {
    const text = prepareJobSpecText(`Role\n\n\n${'A'.repeat(25_000)}`)

    expect(text.length).toBe(20_000)
  })

  it('keeps skills, which come last, for a long CV', () => {
    const experience = Array.from(
      { length: 40 },
      (_, index) => `Role ${index} at Company ${index}: ${'delivered projects '.repeat(6)}`,
    ).join('\n')
    const text = prepareCandidateText('BSc Computer Science', experience, ['Kubernetes'], {
      full_name: 'Thandi Mokoena',
      email: '',
      phone: '',
    })

    expect(experience.length).toBeGreaterThan(3_000)
    expect(text).toContain('Kubernetes')
  })
})

describe('assessment prompt', () => {
  it('shows the model the same id format the requirements use', () => {
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('"minimum-1"')
    expect(ASSESSMENT_SYSTEM_PROMPT).not.toContain('req-1')
  })
})
