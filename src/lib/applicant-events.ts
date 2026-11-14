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

export function formatRelativeTime(createdAt: string, now: Date = new Date()): string {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) {
    return 'just now'
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }

  const days = Math.floor(hours / 24)

  if (days === 1) {
    return 'yesterday'
  }

  if (days < 30) {
    return `${days} days ago`
  }

  return formatEventTime(createdAt)
}
