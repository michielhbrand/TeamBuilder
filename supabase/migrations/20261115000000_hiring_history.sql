create table public.hiring_monthly (
  month date not null,
  department text not null,
  applicants_in integer not null default 0,
  hired integer not null default 0,
  rejected integer not null default 0,
  primary key (month, department),
  constraint hiring_monthly_month_check check (month = date_trunc('month', month)::date),
  constraint hiring_monthly_counts_check check (
    applicants_in >= 0 and hired >= 0 and rejected >= 0
  )
);

create table public.hire_history (
  applicant_id uuid primary key,
  department text not null,
  hired_on date not null,
  days_to_hire smallint not null,
  constraint hire_history_days_check check (days_to_hire >= 0)
);

create index hire_history_hired_on_idx on public.hire_history (hired_on);

alter table public.hiring_monthly enable row level security;
alter table public.hire_history enable row level security;

create policy "Authenticated users can read hiring monthly"
  on public.hiring_monthly for select to authenticated using (true);

create policy "Authenticated users can read hire history"
  on public.hire_history for select to authenticated using (true);

revoke all on table public.hiring_monthly from anon, authenticated;
revoke all on table public.hire_history from anon, authenticated;
grant select on table public.hiring_monthly to authenticated;
grant select on table public.hire_history to authenticated;

create or replace function public.bump_hiring_month(
  p_month date,
  p_department text,
  p_in integer,
  p_hired integer,
  p_rejected integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  insert into public.hiring_monthly (month, department, applicants_in, hired, rejected)
  values (
    v_month,
    p_department,
    greatest(p_in, 0),
    greatest(p_hired, 0),
    greatest(p_rejected, 0)
  )
  on conflict (month, department) do update
  set applicants_in = greatest(public.hiring_monthly.applicants_in + p_in, 0),
      hired = greatest(public.hiring_monthly.hired + p_hired, 0),
      rejected = greatest(public.hiring_monthly.rejected + p_rejected, 0);
end;
$$;

create or replace function public.record_hiring_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_department text;
  v_board_created date;
  v_hired_on date;
  v_hired_department text;
  v_rejected_month date;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select department, (created_at at time zone 'utc')::date
  into v_department, v_board_created
  from public.boards
  where id = new.board_id;

  if v_department is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.bump_hiring_month(
      (new.applied_at at time zone 'utc')::date, v_department, 1, 0, 0
    );
    return new;
  end if;

  if old.status = 'hired' then
    delete from public.hire_history
    where applicant_id = new.id
    returning hired_on, department into v_hired_on, v_hired_department;

    if v_hired_on is not null then
      perform public.bump_hiring_month(v_hired_on, v_hired_department, 0, -1, 0);
    end if;
  elsif old.status = 'rejected' then
    select (created_at at time zone 'utc')::date
    into v_rejected_month
    from public.applicant_events
    where board_id = new.board_id
      and applicant_id = new.id
      and action = 'rejected'
    order by created_at desc
    limit 1;

    perform public.bump_hiring_month(coalesce(v_rejected_month, v_today), v_department, 0, 0, -1);
  end if;

  if new.status = 'hired' then
    perform public.bump_hiring_month(v_today, v_department, 0, 1, 0);

    insert into public.hire_history (applicant_id, department, hired_on, days_to_hire)
    values (
      new.id,
      v_department,
      v_today,
      greatest(0, least(32767, v_today - v_board_created))
    )
    on conflict (applicant_id) do update
    set department = excluded.department,
        hired_on = excluded.hired_on,
        days_to_hire = excluded.days_to_hire;
  elsif new.status = 'rejected' then
    perform public.bump_hiring_month(v_today, v_department, 0, 0, 1);
  end if;

  return new;
end;
$$;

create trigger applicants_record_history
  after insert or update on public.applicants
  for each row execute function public.record_hiring_history();

revoke execute on function public.bump_hiring_month(date, text, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.record_hiring_history() from public, anon, authenticated;

with decided as (
  select
    a.id,
    a.status,
    b.department,
    (coalesce(
      (
        select max(e.created_at)
        from public.applicant_events e
        where e.applicant_id = a.id and e.action = a.status
      ),
      a.updated_at
    ) at time zone 'utc')::date as decided_on
  from public.applicants a
  join public.boards b on b.id = a.board_id
  where a.status in ('hired', 'rejected')
),
monthly as (
  select
    date_trunc('month', (a.applied_at at time zone 'utc')::date)::date as month,
    b.department,
    count(*)::integer as applicants_in,
    0 as hired,
    0 as rejected
  from public.applicants a
  join public.boards b on b.id = a.board_id
  group by 1, 2
  union all
  select
    date_trunc('month', decided_on)::date,
    department,
    0,
    count(*) filter (where status = 'hired')::integer,
    count(*) filter (where status = 'rejected')::integer
  from decided
  group by 1, 2
)
insert into public.hiring_monthly (month, department, applicants_in, hired, rejected)
select month, department, sum(applicants_in), sum(hired), sum(rejected)
from monthly
group by month, department
on conflict (month, department) do update
set applicants_in = excluded.applicants_in,
    hired = excluded.hired,
    rejected = excluded.rejected;

insert into public.hire_history (applicant_id, department, hired_on, days_to_hire)
select
  a.id,
  b.department,
  d.hired_on,
  greatest(0, least(32767, d.hired_on - (b.created_at at time zone 'utc')::date))::smallint
from public.applicants a
join public.boards b on b.id = a.board_id
cross join lateral (
  select (coalesce(
    (
      select max(e.created_at)
      from public.applicant_events e
      where e.applicant_id = a.id and e.action = 'hired'
    ),
    a.updated_at
  ) at time zone 'utc')::date as hired_on
) d
where a.status = 'hired'
on conflict (applicant_id) do update
set department = excluded.department,
    hired_on = excluded.hired_on,
    days_to_hire = excluded.days_to_hire;
