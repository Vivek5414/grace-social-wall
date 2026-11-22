begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'grace-social-wall-media',
  'grace-social-wall-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
);

create policy "Admins can read Grace Social Wall media"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'grace-social-wall-media'
    and (select public.is_admin())
  );

create policy "Admins can upload Grace Social Wall media for posts"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'grace-social-wall-media'
    and (select public.is_admin())
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
    and exists (
      select 1
      from public.social_posts
      where id::text = split_part(storage.objects.name, '/', 1)
    )
  );

create policy "Admins can delete Grace Social Wall media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'grace-social-wall-media'
    and (select public.is_admin())
  );

commit;
