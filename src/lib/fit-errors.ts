export function friendlyError(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('429') ||
    normalized.includes('rate limit') ||
    normalized.includes('rate-limited')
  ) {
    return 'The free model is rate-limited right now. Try again later.'
  }

  if (normalized.includes('kilo_api_key')) {
    return 'Fit analysis is not configured. Ask an administrator to set the Kilo API key.'
  }

  if (normalized.includes('not found') || normalized.includes('404')) {
    return 'Fit analysis is not available yet. Make sure the Edge Function is deployed.'
  }

  if (normalized.includes('job spec')) {
    return message
  }

  if (normalized.includes('cv')) {
    return message
  }

  return message || 'The fit analysis could not be completed. Try again later.'
}
