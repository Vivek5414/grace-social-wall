begin;

revoke all privileges on table public.social_hashtags
  from public, anon, authenticated;
revoke all privileges (id, hashtag, is_active, created_at)
  on table public.social_hashtags
  from public, anon, authenticated;
grant select on table public.social_hashtags to anon, authenticated;
grant insert (hashtag, is_active), update (hashtag, is_active)
  on table public.social_hashtags
  to authenticated;

revoke all privileges on table public.social_posts
  from public, anon, authenticated;
revoke all privileges (
    id, platform, external_post_id, author_name, author_username, caption,
    post_url, media_type, media_url, posted_at, approval_status, approved_at,
    created_at
  )
  on table public.social_posts
  from public, anon, authenticated;
grant select on table public.social_posts to anon, authenticated;
grant update (approval_status, approved_at)
  on table public.social_posts
  to authenticated;

revoke all privileges on table public.social_post_hashtags
  from public, anon, authenticated;
revoke all privileges (post_id, hashtag_id)
  on table public.social_post_hashtags
  from public, anon, authenticated;
grant select on table public.social_post_hashtags to anon, authenticated;
grant insert (post_id, hashtag_id), delete
  on table public.social_post_hashtags
  to authenticated;

revoke all privileges on table public.social_moderation_logs
  from public, anon, authenticated;
revoke all privileges (id, post_id, action, admin_user_id, notes, created_at)
  on table public.social_moderation_logs
  from public, anon, authenticated;
grant select on table public.social_moderation_logs to authenticated;
grant insert (post_id, action, admin_user_id, notes)
  on table public.social_moderation_logs
  to authenticated;

create policy "Admins can view all social hashtags"
  on public.social_hashtags
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can insert social hashtags"
  on public.social_hashtags
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update social hashtags"
  on public.social_hashtags
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can view all social posts"
  on public.social_posts
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can moderate social posts"
  on public.social_posts
  for update
  to authenticated
  using ((select public.is_admin()))
  with check (
    (select public.is_admin())
    and approval_status in ('pending', 'approved', 'rejected', 'removed')
  );

create policy "Admins can view all social post hashtags"
  on public.social_post_hashtags
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can add social post hashtags"
  on public.social_post_hashtags
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can remove social post hashtags"
  on public.social_post_hashtags
  for delete
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can view social moderation logs"
  on public.social_moderation_logs
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can create their own moderation logs"
  on public.social_moderation_logs
  for insert
  to authenticated
  with check (
    (select public.is_admin())
    and admin_user_id = (select auth.uid())
  );

commit;
