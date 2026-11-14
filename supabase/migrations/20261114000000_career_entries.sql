alter table public.applicants
  alter column education drop default,
  alter column experience drop default;

alter table public.applicants
  alter column education type jsonb using (
    case
      when btrim(education) = '' then '[]'::jsonb
      when btrim(education) ~ '^\[[[:space:]]*\]$' then '[]'::jsonb
      when left(btrim(education), 2) = '[{' then btrim(education)::jsonb
      else jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'title', '',
          'organization', '',
          'start', '',
          'end', '',
          'current', false,
          'description', btrim(education)
        )
      )
    end
  ),
  alter column experience type jsonb using (
    case
      when btrim(experience) = '' then '[]'::jsonb
      when btrim(experience) ~ '^\[[[:space:]]*\]$' then '[]'::jsonb
      when left(btrim(experience), 2) = '[{' then btrim(experience)::jsonb
      else jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'title', '',
          'organization', '',
          'start', '',
          'end', '',
          'current', false,
          'description', btrim(experience)
        )
      )
    end
  );

alter table public.applicants
  alter column education set default '[]'::jsonb,
  alter column experience set default '[]'::jsonb,
  add constraint applicants_education_is_array check (jsonb_typeof(education) = 'array'),
  add constraint applicants_experience_is_array check (jsonb_typeof(experience) = 'array');
