alter table public.applicant_events
  drop constraint applicant_events_action_check;

alter table public.applicant_events
  add constraint applicant_events_action_check check (
    action in ('created', 'moved', 'edited', 'hired', 'rejected', 'reopened')
  );
