import type { ApplicantEventAction } from '@/types/pipeline'

export const DEFAULT_ACTOR_NAME = 'A teammate'

const eventTimeFormat = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function createdApplicantMessage(actorName: string, candidateName: string): string {
  return `${actorName} has added ${candidateName} as an applicant`
}

export function editedProfileMessage(actorName: string, candidateName: string): string {
  return `${actorName} has edited ${candidateName}'s profile details`
}

export function movedCandidateMessage(
  actorName: string,
  candidateName: string,
  stepName: string,
): string {
  return `${actorName} has moved ${candidateName} to ${stepName} step`
}

export function statusChangeMessage(
  actorName: string,
  candidateName: string,
  action: Extract<ApplicantEventAction, 'hired' | 'rejected' | 'reopened'>,
): string {
  return `${actorName} has ${action} ${candidateName}`
}

export function formatEventTime(createdAt: string): string {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return eventTimeFormat.format(date)
}
