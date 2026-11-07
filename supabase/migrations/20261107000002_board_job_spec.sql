alter table public.boards
  add column if not exists job_spec_path text,
  add column if not exists job_spec_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-specs', 'job-specs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Job specs are readable by authenticated users" on storage.objects;
drop policy if exists "Job specs can be uploaded by authenticated users" on storage.objects;
drop policy if exists "Job specs can be updated by authenticated users" on storage.objects;
drop policy if exists "Job specs can be deleted by authenticated users" on storage.objects;

create policy "Job specs are readable by authenticated users"
  on storage.objects for select to authenticated
  using (bucket_id = 'job-specs');

create policy "Job specs can be uploaded by authenticated users"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'job-specs');

create policy "Job specs can be updated by authenticated users"
  on storage.objects for update to authenticated
  using (bucket_id = 'job-specs')
  with check (bucket_id = 'job-specs');

create policy "Job specs can be deleted by authenticated users"
  on storage.objects for delete to authenticated
  using (bucket_id = 'job-specs');
