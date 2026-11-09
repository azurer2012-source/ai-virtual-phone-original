-- Preparation ONLY: do not run against a shared/live project without review.
-- First create/invite your email in Authentication > Users, then replace the UUID below.
-- All changes are transactional; existing objects and backup paths are not moved.
begin;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage'
             and tablename = 'objects' and policyname not like 'ai_phone_email_backup_%') then
    raise exception 'Existing Storage policies require manual review. No changes applied.';
  end if;
  if exists (select 1 from storage.buckets where id = 'ai-phone-backup' and public = true) then
    raise exception 'Backup bucket is public. Review before proceeding.';
  end if;
end $$;

create table if not exists public.ai_phone_backup_owner (
  singleton integer primary key check (singleton = 1),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.ai_phone_backup_owner enable row level security;
revoke all on public.ai_phone_backup_owner from anon, authenticated;
grant select on public.ai_phone_backup_owner to authenticated;
drop policy if exists ai_phone_email_backup_owner on public.ai_phone_backup_owner;
create policy ai_phone_email_backup_owner on public.ai_phone_backup_owner
  for select to authenticated using (user_id = (select auth.uid()));

-- Replace the placeholder with the UUID of YOUR email user, not the email address.
-- No upsert: an already-configured owner is not silently replaced.
insert into public.ai_phone_backup_owner(singleton, user_id)
values (1, 'REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid);

insert into storage.buckets(id, name, public)
values ('ai-phone-backup', 'ai-phone-backup', false)
on conflict (id) do nothing;

drop policy if exists ai_phone_email_backup_read on storage.objects;
drop policy if exists ai_phone_email_backup_insert on storage.objects;
drop policy if exists ai_phone_email_backup_update on storage.objects;
drop policy if exists ai_phone_email_backup_delete on storage.objects;

create policy ai_phone_email_backup_read on storage.objects for select to authenticated
using (bucket_id = 'ai-phone-backup' and exists (
  select 1 from public.ai_phone_backup_owner where user_id = (select auth.uid())
));
create policy ai_phone_email_backup_insert on storage.objects for insert to authenticated
with check (bucket_id = 'ai-phone-backup' and exists (
  select 1 from public.ai_phone_backup_owner where user_id = (select auth.uid())
));
create policy ai_phone_email_backup_update on storage.objects for update to authenticated
using (bucket_id = 'ai-phone-backup' and exists (
  select 1 from public.ai_phone_backup_owner where user_id = (select auth.uid())
)) with check (bucket_id = 'ai-phone-backup' and exists (
  select 1 from public.ai_phone_backup_owner where user_id = (select auth.uid())
));
create policy ai_phone_email_backup_delete on storage.objects for delete to authenticated
using (bucket_id = 'ai-phone-backup' and exists (
  select 1 from public.ai_phone_backup_owner where user_id = (select auth.uid())
));
commit;
