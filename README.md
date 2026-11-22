# Grace Social Wall

Grace Social Wall is a responsive admin dashboard for reviewing social content in a demo workspace.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Dashboard behavior

- The admin dashboard reads posts, hashtag relationships, hashtags, and moderation activity from the existing Supabase tables using the signed-in administrator's session.
- Post totals use database counts. Platform distribution describes only the latest 100 loaded posts.
- Approve, Reject, and Remove update `social_posts` and append an entry to `social_moderation_logs`. Removing a post sets its status to `removed`; it does not delete the database row.
- Administrators can create, edit, activate/deactivate, and delete hashtags. The foreign key may block deleting a hashtag already associated with posts.
- The dedicated private `grace-social-wall-media` bucket stores admin-uploaded post attachments. The dashboard issues five-minute signed links after verifying administrator access.
- All four social platform cards start as **Not connected**. OAuth, credentials, sync jobs, sync logs, and persisted workspace preferences are not implemented.
- Reusable dashboard components are organized under `src/components/dashboard/`; Supabase reads are in `src/lib/dashboard/data.ts`.
- Dashboard styles use global CSS in `src/app/globals.css`.

## Administrator Access Setup

1. In the Supabase Dashboard for this project, open **SQL Editor** and run `supabase/migrations/20261122162000_admin_allowlist.sql`.
2. Then run `supabase/migrations/20261122170000_admin_social_moderation_policies.sql`. It adds policies and grants to the existing social tables; it does not recreate or rename them.
3. Run `supabase/migrations/20261122170500_admin_social_grant_reconciliation.sql` to reassert the least-privilege grants and enable allowlisted administrators to delete hashtags. This is safe to use after the second migration; do not rerun a migration whose policies already exist. Foreign-key references can still prevent deleting a hashtag used by posts.
4. Run `supabase/migrations/20261122192000_admin_private_media_bucket.sql` to create the new private media bucket and bucket-scoped admin policies. It does not modify existing buckets or policies.
5. In **Authentication → Settings**, disable public sign-ups. Provision administrator users through the Supabase Dashboard, not a public registration page.
6. In **Authentication → Users**, invite the administrator. Copy that user's UUID and add it in the SQL Editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('<AUTH_USER_UUID>'::uuid)
   on conflict (user_id) do nothing;
   ```

The first migration grants no browser insert, update, or delete access to `admin_users`. It creates `public.is_admin()` for the social moderation policies. The second migration establishes the RLS policies and least-privilege grants. The third reasserts those grants (including removal of privileges such as `TRUNCATE`) and grants hashtag deletion to allowlisted administrators only. RLS policies preserve reads for active hashtags, approved posts, and their hashtag links. Post deletion is not granted, and moderation logs can only be read or inserted by administrators (logs are immutable).

The admin dashboard requires both migrations and an allowlisted administrator. Social post reads and moderation actions also depend on the administrator RLS policies from the second migration.

Run the project checks with:

```bash
npm run lint
npm test
npm run build
```

`npm test` performs read-only route smoke checks against `GRACE_SOCIAL_WALL_BASE_URL` (defaults to `http://localhost:3000`) and expects the app to be running. It does not sign in or change database records.
