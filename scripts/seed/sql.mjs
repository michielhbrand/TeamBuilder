const CHUNK = 100

function str(value) {
  return value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
}

function ts(value) {
  return `'${value.toISOString()}'::timestamptz`
}

function json(value) {
  return `${str(JSON.stringify(value))}::jsonb`
}

function insert(table, columns, rows) {
  const statements = []
  for (let index = 0; index < rows.length; index += CHUNK) {
    const values = rows
      .slice(index, index + CHUNK)
      .map((row) => `  (${row.join(', ')})`)
      .join(',\n')
    statements.push(`insert into ${table} (${columns.join(', ')}) values\n${values};`)
  }
  return statements.join('\n\n')
}

export function buildSql(dataset, { replace, rehearse }) {
  const parts = ['begin;']

  if (replace) {
    parts.push(
      '-- replace: remove every existing board (cascades to applicants, events, notes, fit data) and all history',
      'delete from public.boards;',
      'delete from public.hire_history;',
      'delete from public.hiring_monthly;',
    )
  }

  parts.push(
    'alter table public.applicants disable trigger applicants_log_events;',
    'alter table public.applicants disable trigger applicants_record_history;',
  )

  parts.push(
    insert(
      'public.boards',
      [
        'id',
        'name',
        'department',
        'open_positions',
        'deadline',
        'created_at',
        'updated_at',
        'job_spec_path',
        'job_spec_name',
      ],
      dataset.boards.map((board) => [
        str(board.id),
        str(board.name),
        str(board.department),
        board.open_positions,
        `${str(board.deadline)}::date`,
        ts(board.created_at),
        ts(board.created_at),
        str(board.job_spec_path),
        str(board.job_spec_name),
      ]),
    ),
    insert(
      'public.board_columns',
      ['id', 'board_id', 'name', 'position', 'created_at', 'updated_at'],
      dataset.columns.map((column) => [
        str(column.id),
        str(column.board_id),
        str(column.name),
        column.position,
        ts(column.created_at),
        ts(column.created_at),
      ]),
    ),
    insert(
      'public.applicants',
      [
        'id',
        'board_id',
        'column_id',
        'full_name',
        'email',
        'phone',
        'job_title',
        'education',
        'experience',
        'skills',
        'favorite',
        'status',
        'applied_at',
        'step_entered_at',
        'created_at',
        'updated_at',
        'cv_path',
        'cv_name',
        'notice_period_months',
        'salary_expectation_cents',
        'rem_channel',
        'salary_band',
      ],
      dataset.applicants.map((applicant) => [
        str(applicant.id),
        str(applicant.board_id),
        str(applicant.column_id),
        str(applicant.full_name),
        str(applicant.email),
        str(applicant.phone),
        str(applicant.job_title),
        json(applicant.education),
        json(applicant.experience),
        json(applicant.skills),
        applicant.favorite ? 'true' : 'false',
        str(applicant.status),
        ts(applicant.applied_at),
        ts(applicant.step_entered_at),
        ts(applicant.applied_at),
        ts(applicant.updated_at),
        str(applicant.cv_path),
        str(applicant.cv_name),
        applicant.notice_period_months,
        applicant.salary_expectation_cents,
        str(applicant.rem_channel),
        str(applicant.salary_band),
      ]),
    ),
    insert(
      'public.applicant_events',
      [
        'id',
        'board_id',
        'applicant_id',
        'actor_id',
        'actor_name',
        'action',
        'message',
        'created_at',
      ],
      dataset.events.map((event) => [
        str(event.id),
        str(event.board_id),
        str(event.applicant_id),
        str(event.actor_id),
        str(event.actor_name),
        str(event.action),
        str(event.message),
        ts(event.created_at),
      ]),
    ),
    insert(
      'public.applicant_notes',
      ['id', 'board_id', 'applicant_id', 'author_id', 'author_name', 'body', 'created_at'],
      dataset.notes.map((note) => [
        str(note.id),
        str(note.board_id),
        str(note.applicant_id),
        str(note.author_id),
        str(note.author_name),
        str(note.body),
        ts(note.created_at),
      ]),
    ),
    insert(
      'public.hiring_monthly',
      ['month', 'department', 'applicants_in', 'hired', 'rejected'],
      dataset.hiringMonthly.map((row) => [
        `${str(row.month)}::date`,
        str(row.department),
        row.applicants_in,
        row.hired,
        row.rejected,
      ]),
    ),
    insert(
      'public.hire_history',
      ['applicant_id', 'department', 'hired_on', 'days_to_hire'],
      dataset.hireHistory.map((row) => [
        str(row.applicant_id),
        str(row.department),
        `${str(row.hired_on)}::date`,
        row.days_to_hire,
      ]),
    ),
    'alter table public.applicants enable trigger applicants_log_events;',
    'alter table public.applicants enable trigger applicants_record_history;',
    rehearse ? 'rollback;' : 'commit;',
  )

  return `${parts.join('\n\n')}\n`
}
