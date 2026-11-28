alter table public.boards
  add column fit_weights jsonb not null
  default '{"minimum":50,"recommended":30,"skills":20}'::jsonb;

alter table public.boards
  add constraint boards_fit_weights_check check (
    jsonb_typeof(fit_weights) = 'object'
    and jsonb_typeof(fit_weights->'minimum') = 'number'
    and jsonb_typeof(fit_weights->'recommended') = 'number'
    and jsonb_typeof(fit_weights->'skills') = 'number'
    and (fit_weights->>'minimum')::numeric between 0 and 100
    and (fit_weights->>'recommended')::numeric between 0 and 100
    and (fit_weights->>'skills')::numeric between 0 and 100
    and (fit_weights->>'minimum')::numeric
      + (fit_weights->>'recommended')::numeric
      + (fit_weights->>'skills')::numeric = 100
  );
