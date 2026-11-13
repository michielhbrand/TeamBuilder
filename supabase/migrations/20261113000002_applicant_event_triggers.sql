create or replace function public.log_applicant_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_step_name text;
  v_action text;
begin
  v_actor_name := coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() ->> 'email'), ''),
    'A teammate'
  );

  if tg_op = 'INSERT' then
    insert into public.applicant_events (board_id, applicant_id, actor_name, action, message)
    values (
      new.board_id,
      new.id,
      v_actor_name,
      'created',
      v_actor_name || ' has added ' || new.full_name || ' as an applicant'
    );

    return new;
  end if;

  if new.column_id is distinct from old.column_id then
    select name into v_step_name
    from public.board_columns
    where id = new.column_id
      and board_id = new.board_id;

    if v_step_name is not null then
      insert into public.applicant_events (board_id, applicant_id, actor_name, action, message)
      values (
        new.board_id,
        new.id,
        v_actor_name,
        'moved',
        v_actor_name || ' has moved ' || new.full_name || ' to ' || v_step_name || ' step'
      );
    end if;
  end if;

  if new.status is distinct from old.status then
    v_action := case new.status
      when 'hired' then 'hired'
      when 'rejected' then 'rejected'
      when 'active' then 'reopened'
      else null
    end;

    if v_action is not null then
      insert into public.applicant_events (board_id, applicant_id, actor_name, action, message)
      values (
        new.board_id,
        new.id,
        v_actor_name,
        v_action,
        v_actor_name || ' has ' || v_action || ' ' || new.full_name
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger applicants_log_events
  after insert or update on public.applicants
  for each row execute function public.log_applicant_event();

create or replace function public.record_applicant_edit_event(p_applicant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_board_id uuid;
  v_applicant_name text;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to record an edit event';
  end if;

  select board_id, full_name
  into v_board_id, v_applicant_name
  from public.applicants
  where id = p_applicant_id;

  if v_board_id is null then
    raise exception 'Applicant not found';
  end if;

  v_actor_name := coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() ->> 'email'), ''),
    'A teammate'
  );

  insert into public.applicant_events (board_id, applicant_id, actor_id, actor_name, action, message)
  values (
    v_board_id,
    p_applicant_id,
    v_actor_id,
    v_actor_name,
    'edited',
    v_actor_name || ' has edited ' || v_applicant_name || '''s profile details'
  );
end;
$$;

revoke execute on function public.log_applicant_event() from public, anon, authenticated;

revoke execute on function public.record_applicant_edit_event(uuid) from public, anon;
grant execute on function public.record_applicant_edit_event(uuid) to authenticated;

drop policy if exists "Authenticated users can insert applicant events" on public.applicant_events;

revoke insert, update, delete on table public.applicant_events from authenticated;
grant select on table public.applicant_events to authenticated;
