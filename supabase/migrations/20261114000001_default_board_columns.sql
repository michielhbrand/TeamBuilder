create or replace function public.create_board(
  p_name text,
  p_department text,
  p_deadline date,
  p_open_positions integer
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_board_id uuid;
begin
  insert into public.boards (name, department, deadline, open_positions)
  values (p_name, p_department, p_deadline, p_open_positions)
  returning id into v_board_id;

  insert into public.board_columns (board_id, name, position)
  values
    (v_board_id, 'Applied', 0),
    (v_board_id, 'Interview', 1),
    (v_board_id, 'Offer', 2);

  return v_board_id;
end;
$$;

revoke execute on function public.create_board(text, text, date, integer) from public, anon;
grant execute on function public.create_board(text, text, date, integer) to authenticated;
