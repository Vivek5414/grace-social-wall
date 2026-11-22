-- Optional SQL seed for the separately identified Milestone 2 test hashtag.
-- Do not run this seed when testing hashtag creation through the dashboard UI:
-- create #GRACE_TEST_MILESTONE_2 with the Add hashtag action instead.
-- No hashtag has been inserted by the assistant.

begin;

do $preflight$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'social_hashtags'
      and c.relrowsecurity
  ) then
    raise exception 'RLS is not enabled on public.social_hashtags. Aborting.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_hashtags'
      and policyname = 'Admins can insert social hashtags'
      and cmd = 'INSERT'
      and coalesce(with_check, '') ilike '%is_admin%'
  ) then
    raise exception 'The admin-only hashtag insert policy is missing. Aborting.';
  end if;

  if exists (
    select 1 from public.social_hashtags
    where id = '04459593-2d64-4da4-8fc0-6b6168a242da'::uuid
       or hashtag = '#GRACE_TEST_MILESTONE_2'
  ) then
    raise exception 'The test hashtag UUID or name already exists. No rows were changed.';
  end if;
end
$preflight$;

insert into public.social_hashtags (id, hashtag, is_active)
values (
  '04459593-2d64-4da4-8fc0-6b6168a242da'::uuid,
  '#GRACE_TEST_MILESTONE_2',
  true
);

select id, hashtag, is_active, created_at
from public.social_hashtags
where id = '04459593-2d64-4da4-8fc0-6b6168a242da'::uuid;

commit;
