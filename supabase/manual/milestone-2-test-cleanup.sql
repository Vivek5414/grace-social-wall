-- Cleanup for Milestone 2 fixtures only. Run manually after testing.
-- Post deletes require the exact generated UUID and matching test marker.
-- The test hashtag delete uses its reserved unique marker and skips linked tags.
-- This removes moderation logs associated only with these fixtures so the
-- append-only behavior can be tested during the run, then cleaned up afterward.

begin;

delete from public.social_post_hashtags
where post_id in (
    '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid,
    'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid,
    '40dd6933-0628-4dfb-8052-80f248093009'::uuid
  )
  and exists (
    select 1
    from public.social_posts p
    where p.id = social_post_hashtags.post_id
      and (
        (p.id = '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid
          and p.external_post_id = 'GRACE_TEST_APPROVE')
        or (p.id = 'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid
          and p.external_post_id = 'GRACE_TEST_REJECT')
        or (p.id = '40dd6933-0628-4dfb-8052-80f248093009'::uuid
          and p.external_post_id = 'GRACE_TEST_REMOVE')
      )
  );

delete from public.social_moderation_logs
where post_id in (
    '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid,
    'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid,
    '40dd6933-0628-4dfb-8052-80f248093009'::uuid
  )
  and exists (
    select 1
    from public.social_posts p
    where p.id = social_moderation_logs.post_id
      and (
        (p.id = '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid
          and p.external_post_id = 'GRACE_TEST_APPROVE')
        or (p.id = 'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid
          and p.external_post_id = 'GRACE_TEST_REJECT')
        or (p.id = '40dd6933-0628-4dfb-8052-80f248093009'::uuid
          and p.external_post_id = 'GRACE_TEST_REMOVE')
      )
  );

delete from public.social_posts
where platform = 'instagram'
  and (
    (id = '82e2ec00-7ca6-482b-9d6d-db70376efba6'::uuid
      and external_post_id = 'GRACE_TEST_APPROVE')
    or (id = 'b6371cce-6216-41b2-9e91-3c4a0603cd03'::uuid
      and external_post_id = 'GRACE_TEST_REJECT')
    or (id = '40dd6933-0628-4dfb-8052-80f248093009'::uuid
      and external_post_id = 'GRACE_TEST_REMOVE')
);

-- The test hashtag is removed only if its reserved name is still unique to this
-- test and it has no remaining post associations.
delete from public.social_post_hashtags
where hashtag_id = '04459593-2d64-4da4-8fc0-6b6168a242da'::uuid
  and exists (
    select 1
    from public.social_hashtags h
    where h.id = social_post_hashtags.hashtag_id
      and h.hashtag = '#GRACE_TEST_MILESTONE_2'
  );

delete from public.social_hashtags
where hashtag = '#GRACE_TEST_MILESTONE_2'
  and not exists (
    select 1 from public.social_post_hashtags r
    where r.hashtag_id = social_hashtags.id
  );

commit;
