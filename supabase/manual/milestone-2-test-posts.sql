-- Milestone 2 moderation fixtures. Run manually in the Supabase SQL Editor
-- only after reviewing the preflight checks below. This script inserts exactly
-- three fictional records and does not create moderation logs.

begin;

do $preflight$
declare
  table_name text;
  rls_enabled boolean;
  check_definitions text;
  required_column text;
begin
  foreach table_name in array array[
    'social_posts',
    'social_post_hashtags',
    'social_moderation_logs',
    'social_hashtags'
  ]
  loop
    select c.relrowsecurity
      into rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name;

    if not coalesce(rls_enabled, false) then
      raise exception 'RLS is not enabled on public.%. Aborting without inserting fixtures.', table_name;
    end if;
  end loop;

  foreach required_column in array array[
    'id',
    'platform',
    'external_post_id',
    'author_name',
    'author_username',
    'caption',
    'approval_status',
    'approved_at',
    'created_at'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'social_posts'
        and column_name = required_column
    ) then
      raise exception 'Expected column public.social_posts.% is missing. Aborting.', required_column;
    end if;
  end loop;

  select string_agg(pg_get_constraintdef(c.oid), ' ')
    into check_definitions
    from pg_constraint c
    where c.conrelid = 'public.social_posts'::regclass
      and c.contype = 'c';

  if check_definitions is null
    or check_definitions not ilike '%platform%'
    or check_definitions not ilike '%instagram%'
    or check_definitions not ilike '%facebook%'
    or check_definitions not ilike '%''x''%'
    or check_definitions not ilike '%linkedin%'
    or check_definitions not ilike '%approval_status%'
    or check_definitions not ilike '%pending%'
    or check_definitions not ilike '%approved%'
    or check_definitions not ilike '%rejected%'
    or check_definitions not ilike '%removed%' then
    raise exception 'Expected platform/status CHECK constraints were not found on public.social_posts. Aborting.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'social_posts'
      and indexdef ilike '%create unique index%'
      and indexdef ilike '%(platform, external_post_id)%'
      and indexdef ilike '%external_post_id is not null%'
  ) then
    raise exception 'Expected partial unique index on (platform, external_post_id) was not found. Aborting.';
  end if;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing. Aborting.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_posts'
      and policyname = 'Admins can view all social posts'
      and cmd = 'SELECT'
      and coalesce(qual, '') ilike '%is_admin%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_posts'
      and policyname = 'Admins can moderate social posts'
      and cmd = 'UPDATE'
      and coalesce(qual, '') ilike '%is_admin%'
      and coalesce(with_check, '') ilike '%is_admin%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_moderation_logs'
      and policyname = 'Admins can view social moderation logs'
      and cmd = 'SELECT'
      and coalesce(qual, '') ilike '%is_admin%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_moderation_logs'
      and policyname = 'Admins can create their own moderation logs'
      and cmd = 'INSERT'
      and coalesce(with_check, '') ilike '%is_admin%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_hashtags'
      and policyname = 'Admins can insert social hashtags'
      and cmd = 'INSERT'
      and coalesce(with_check, '') ilike '%is_admin%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_hashtags'
      and policyname = 'Admins can update social hashtags'
      and cmd = 'UPDATE'
      and coalesce(qual, '') ilike '%is_admin%'
      and coalesce(with_check, '') ilike '%is_admin%'
  ) then
    raise exception 'Expected admin post/log/hashtag RLS policies are missing. Aborting.';
  end if;

  if exists (
    select 1
    from public.social_posts
    where id in (
      '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid,
      'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid,
      '40dd6933-0628-4dfb-8052-80f248093009'::uuid
    )
    or (
      platform = 'instagram'
      and external_post_id in (
        'GRACE_TEST_APPROVE',
        'GRACE_TEST_REJECT',
        'GRACE_TEST_REMOVE'
      )
    )
  ) then
    raise exception 'A fixture UUID or external_post_id already exists. No rows were changed.';
  end if;
end
$preflight$;

insert into public.social_posts (
  id,
  platform,
  external_post_id,
  author_name,
  author_username,
  caption,
  approval_status,
  approved_at
)
values
  (
    '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid,
    'instagram',
    'GRACE_TEST_APPROVE',
    'Grace Social Wall QA',
    'grace-social-wall-test',
    'FICTIONAL TEST ONLY: approval workflow check; no real person, customer, or brand content.',
    'pending',
    null
  ),
  (
    'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid,
    'instagram',
    'GRACE_TEST_REJECT',
    'Grace Social Wall QA',
    'grace-social-wall-test',
    'FICTIONAL TEST ONLY: rejection workflow check; no real person, customer, or brand content.',
    'pending',
    null
  ),
  (
    '40dd6933-0628-4dfb-8052-80f248093009'::uuid,
    'instagram',
    'GRACE_TEST_REMOVE',
    'Grace Social Wall QA',
    'grace-social-wall-test',
    'FICTIONAL TEST ONLY: removal workflow check; no real person, customer, or brand content.',
    'approved',
    now()
  );

-- Confirm only the three named fixtures were inserted.
select id, platform, external_post_id, approval_status, approved_at
from public.social_posts
where id in (
  '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid,
  'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid,
  '40dd6933-0628-4dfb-8052-80f248093009'::uuid
)
order by external_post_id;

commit;
