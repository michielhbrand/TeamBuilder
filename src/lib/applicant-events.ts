export const DEFAULT_ACTOR_NAME = 'A teammate'

const eventTimeFormat = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatEventTime(createdAt: string): string {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return eventTimeFormat.format(date)
}
