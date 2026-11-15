alter table public.applicants
  add column rem_channel text not null default '',
  add column salary_band text not null default '';
