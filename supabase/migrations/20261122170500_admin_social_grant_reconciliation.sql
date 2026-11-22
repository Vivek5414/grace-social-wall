begin;

revoke all privileges on table public.social_hashtags
  from public, anon, authenticated;
revoke all privileges (id, hashtag, is_active, created_at)
  on table public.social_hashtags
  from public, anon, authenticated;
grant select on table public.social_hashtags to anon, authenticated;
grant insert (hashtag, is_active), update (hashtag, is_active), delete
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

grant delete on table public.social_hashtags to authenticated;

create policy "Admins can delete social hashtags"
  on public.social_hashtags
  for delete
  to authenticated
  using ((select public.is_admin()));

commit;
