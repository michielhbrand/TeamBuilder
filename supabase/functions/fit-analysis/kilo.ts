const KILO_BASE_URL = 'https://ai-gateway.kilo.ai/api/v1'
const REQUEST_TIMEOUT_MS = 120_000

export const KILO_MAX_TOKENS = 8192

export class HttpError extends Error {
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

export function resolveFreeModel(configured: string | undefined): string {
  const model = configured?.trim() ?? ''

  if (!model) {
    throw new HttpError(503, 'Kilo is not configured. Set KILO_MODEL.')
  }

  const lowered = model.toLowerCase()
  const isFree = model === 'kilo-auto/free' || model.endsWith(':free')

  if (!isFree || lowered.includes('reasoning') || lowered.includes('deep')) {
    throw new HttpError(503, 'Kilo is not configured with a free model.')
  }

  return model
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

export async function callKilo(
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
        reasoning: { enabled: false, type: 'none' },
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
    const reasoningTokens = payload.usage?.completion_tokens_details?.reasoning_tokens ?? 0

    if (reasoningTokens > 0) {
      console.warn('Kilo model reasoned despite reasoning being disabled', {
        requestedModel: model,
        routedModel: payload.model ?? model,
        reasoningTokens,
        completionTokens: payload.usage?.completion_tokens ?? null,
        finishReason: choice?.finish_reason ?? null,
        hasContent: Boolean(content.trim()),
      })
    }

    if (!content.trim()) {
      console.error('Kilo returned no analysis text', {
        model: payload.model ?? model,
        finishReason: choice?.finish_reason ?? null,
        contentType: Array.isArray(choice?.message?.content)
          ? 'array'
          : typeof choice?.message?.content,
        completionTokens: payload.usage?.completion_tokens ?? null,
        reasoningTokens,
      })

      if (choice?.finish_reason === 'length') {
        throw new HttpError(
          502,
          'The free model ran out of output tokens before returning an analysis. Try again later.',
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
