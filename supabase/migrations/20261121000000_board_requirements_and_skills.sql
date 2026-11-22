alter table public.applicants
  add column skills jsonb not null default '[]'::jsonb,
  add constraint applicants_skills_is_array check (jsonb_typeof(skills) = 'array');

create table public.board_requirement_sets (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  job_spec_fingerprint text not null,
  requirements jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_requirement_sets_unique unique (board_id, job_spec_fingerprint),
  constraint board_requirement_sets_is_object check (jsonb_typeof(requirements) = 'object')
);

create trigger board_requirement_sets_set_updated_at
  before update on public.board_requirement_sets
  for each row execute function public.set_updated_at();

alter table public.board_requirement_sets enable row level security;

create policy "Authenticated users can read board requirement sets"
  on public.board_requirement_sets for select to authenticated using (true);

revoke all on table public.board_requirement_sets from authenticated, anon;

grant select on table public.board_requirement_sets to authenticated;

grant select, insert, update, delete on table public.board_requirement_sets to service_role;
