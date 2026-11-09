create table public.applicant_notes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  applicant_id uuid not null,
  author_id uuid not null default auth.uid(),
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint applicant_notes_body_check check (length(btrim(body)) > 0),
  constraint applicant_notes_applicant_fk foreign key (board_id, applicant_id)
    references public.applicants (board_id, id) on delete cascade
);

create index applicant_notes_applicant_created_idx
  on public.applicant_notes (board_id, applicant_id, created_at desc);

alter table public.applicant_notes enable row level security;

create policy "Authenticated users can read applicant notes"
  on public.applicant_notes for select to authenticated using (true);

create policy "Authenticated users can insert applicant notes"
  on public.applicant_notes for insert to authenticated with check (author_id = auth.uid());

grant select, insert on table public.applicant_notes to authenticated;

revoke all on table public.applicant_notes from anon;
