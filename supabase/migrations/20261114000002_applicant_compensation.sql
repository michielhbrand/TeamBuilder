alter table public.applicants
  add column notice_period_months numeric(4, 1) not null default 0
    check (notice_period_months >= 0),
  add column salary_expectation_cents integer not null default 0
    check (salary_expectation_cents >= 0);
