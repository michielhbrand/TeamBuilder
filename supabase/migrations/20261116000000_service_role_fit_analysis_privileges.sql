grant usage on schema public to service_role;

grant select on table public.applicants to service_role;
grant select on table public.boards to service_role;

grant select, insert, update on table public.applicant_fit_analyses to service_role;
grant select, insert on table public.applicant_events to service_role;
