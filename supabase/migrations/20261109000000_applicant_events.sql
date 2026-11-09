alter table public.applicants
  add constraint applicants_board_id_id_unique unique (board_id, id);

create table public.applicant_events (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  applicant_id uuid not null,
  actor_id uuid not null default auth.uid(),
  actor_name text not null,
  action text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint applicant_events_action_check check (
    action in ('moved', 'edited', 'hired', 'rejected', 'reopened')
  ),
  constraint applicant_events_applicant_fk foreign key (board_id, applicant_id)
    references public.applicants (board_id, id) on delete cascade
);

create index applicant_events_applicant_created_idx
  on public.applicant_events (board_id, applicant_id, created_at desc);

alter table public.applicant_events enable row level security;

create policy "Authenticated users can read applicant events"
  on public.applicant_events for select to authenticated using (true);

create policy "Authenticated users can insert applicant events"
  on public.applicant_events for insert to authenticated with check (actor_id = auth.uid());

grant select, insert, delete on table public.applicant_events to authenticated;

revoke all on table public.applicant_events from anon;
