-- Controlled moderation test seed.
-- Run manually in the Supabase SQL Editor; this file is not executed by the app.
-- It inserts three fictional social_posts only and does not create moderation logs.

begin;

do $preflight$
declare
  table_to_check text;
  rls_enabled boolean;
  required_column text;
  check_definitions text;
begin
  foreach table_to_check in array array[
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
        and c.relname = table_to_check;

    if not found or not coalesce(rls_enabled, false) then
      raise exception 'RLS is not enabled on public.%. Aborting without inserting fixtures.', table_to_check;
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

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'social_posts'
      and is_nullable = 'NO'
      and column_default is null
      and column_name not in (
        'id',
        'platform',
        'external_post_id',
        'author_name',
        'author_username',
        'caption',
        'approval_status',
        'approved_at'
      )
  ) then
    raise exception 'social_posts has a required no-default column not covered by this seed. Aborting.';
  end if;

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
    raise exception 'Expected platform/status CHECK constraints are missing or differ. Aborting.';
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
    raise exception 'Expected partial unique index on (platform, external_post_id) is missing. Aborting.';
  end if;

  if to_regprocedure('public.is_admin()') is null
    or not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_posts'
        and policyname = 'Admins can view all social posts'
        and cmd = 'SELECT'
        and coalesce(qual, '') ilike '%is_admin%'
    )
    or not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_posts'
        and policyname = 'Admins can moderate social posts'
        and cmd = 'UPDATE'
        and coalesce(qual, '') ilike '%is_admin%'
        and coalesce(with_check, '') ilike '%is_admin%'
    )
    or not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_moderation_logs'
        and policyname = 'Admins can view social moderation logs'
        and cmd = 'SELECT'
        and coalesce(qual, '') ilike '%is_admin%'
    )
    or not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_moderation_logs'
        and policyname = 'Admins can create their own moderation logs'
        and cmd = 'INSERT'
        and coalesce(with_check, '') ilike '%is_admin%'
        and coalesce(with_check, '') ilike '%auth.uid%'
    ) then
    raise exception 'Expected administrator RLS policies are missing or differ. Aborting.';
  end if;

  if exists (
    select 1
    from public.social_posts
    where id in (
      'e5482353-39b1-4376-a095-966813d4342f'::uuid,
      'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid,
      '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid
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
    raise exception 'A fixture UUID or test marker already exists. No rows were changed.';
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
    'e5482353-39b1-4376-a095-966813d4342f'::uuid,
    'instagram',
    'GRACE_TEST_APPROVE',
    'Grace Social Wall QA',
    'grace-social-wall-test',
    'FICTIONAL TEST ONLY: approval workflow check; no real person, customer, or brand content.',
    'pending',
    null
  ),
  (
    'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid,
    'instagram',
    'GRACE_TEST_REJECT',
    'Grace Social Wall QA',
    'grace-social-wall-test',
    'FICTIONAL TEST ONLY: rejection workflow check; no real person, customer, or brand content.',
    'pending',
    null
  ),
  (
    '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid,
    'instagram',
    'GRACE_TEST_REMOVE',
    'Grace Social Wall QA',
    'grace-social-wall-test',
    'FICTIONAL TEST ONLY: removal workflow check; no real person, customer, or brand content.',
    'approved',
    now()
  );

select id, platform, external_post_id, approval_status, approved_at
from public.social_posts
where id in (
  'e5482353-39b1-4376-a095-966813d4342f'::uuid,
  'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid,
  '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid
)
order by external_post_id;

commit;

/*
Cleanup only — run separately after testing by removing this comment wrapper.
The exact UUID + matching platform + external_post_id are required for each post.
Associated logs are created by dashboard actions, then removed here only for
these fixture posts. No other post, log, or hashtag is targeted.

begin;

delete from public.social_post_hashtags
where post_id in (
  'e5482353-39b1-4376-a095-966813d4342f'::uuid,
  'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid,
  '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid
)
and exists (
  select 1
  from public.social_posts p
  where p.id = social_post_hashtags.post_id
    and p.platform = 'instagram'
    and (
      (p.id = 'e5482353-39b1-4376-a095-966813d4342f'::uuid
        and p.external_post_id = 'GRACE_TEST_APPROVE')
      or (p.id = 'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid
        and p.external_post_id = 'GRACE_TEST_REJECT')
      or (p.id = '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid
        and p.external_post_id = 'GRACE_TEST_REMOVE')
    )
);

delete from public.social_moderation_logs
where post_id in (
  'e5482353-39b1-4376-a095-966813d4342f'::uuid,
  'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid,
  '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid
)
and exists (
  select 1
  from public.social_posts p
  where p.id = social_moderation_logs.post_id
    and p.platform = 'instagram'
    and (
      (p.id = 'e5482353-39b1-4376-a095-966813d4342f'::uuid
        and p.external_post_id = 'GRACE_TEST_APPROVE')
      or (p.id = 'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid
        and p.external_post_id = 'GRACE_TEST_REJECT')
      or (p.id = '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid
        and p.external_post_id = 'GRACE_TEST_REMOVE')
    )
);

delete from public.social_posts
where platform = 'instagram'
  and (
    (id = 'e5482353-39b1-4376-a095-966813d4342f'::uuid
      and external_post_id = 'GRACE_TEST_APPROVE')
    or (id = 'cb0fa852-2e67-43d3-afea-66c71b53fa35'::uuid
      and external_post_id = 'GRACE_TEST_REJECT')
    or (id = '6f36f256-1451-425c-af8b-209cd0a6acbf'::uuid
      and external_post_id = 'GRACE_TEST_REMOVE')
  );

commit;
*/
