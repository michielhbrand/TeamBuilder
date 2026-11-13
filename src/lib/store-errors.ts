export function friendlyDataError(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('boards_department_name_lower_key') ||
    normalized.includes('boards_name_lower_key') ||
    normalized.includes('boards_name_unique')
  ) {
    return 'A board with that name already exists in this department.'
  }

  if (normalized.includes('applicants_board_email_lower_key')) {
    return 'An applicant with that email already exists on this board.'
  }

  if (normalized.includes('applicants_board_phone_key')) {
    return 'An applicant with that phone number already exists on this board.'
  }

  if (normalized.includes('board_columns_board_name_lower_key')) {
    return 'A column with that name already exists on this board.'
  }

  if (normalized.includes('first board column')) {
    return 'The first column cannot be deleted.'
  }

  return message
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return friendlyDataError(error.message)
  }

  return 'Could not save changes. Please try again.'
}
