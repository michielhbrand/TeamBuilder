create table public.applicant_fit_analyses (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  applicant_id uuid not null,
  cv_fingerprint text not null,
  job_spec_fingerprint text not null,
  profile_fingerprint text not null,
  provider text not null default 'kilo',
  model text not null,
  prompt_version text not null,
  score integer not null check (score between 0 and 100),
  verdict text not null check (verdict in ('strong', 'partial', 'limited')),
  result jsonb not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applicant_fit_analyses_applicant_fk foreign key (board_id, applicant_id)
    references public.applicants (board_id, id) on delete cascade,
  constraint applicant_fit_analyses_applicant_unique unique (board_id, applicant_id)
);

create index applicant_fit_analyses_board_idx
  on public.applicant_fit_analyses (board_id);

create trigger applicant_fit_analyses_set_updated_at
  before update on public.applicant_fit_analyses
  for each row execute function public.set_updated_at();

alter table public.applicant_fit_analyses enable row level security;

create policy "Authenticated users can read applicant fit analyses"
  on public.applicant_fit_analyses for select to authenticated using (true);

revoke all on table public.applicant_fit_analyses from authenticated, anon;

grant select on table public.applicant_fit_analyses to authenticated;
