# Grace Social Wall

Grace Social Wall is a responsive admin dashboard for reviewing social content in a demo workspace.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Public Instagram Demo

The root URL redirects to `/demo`, a public, read-only Instagram Hashtag Discovery page. It does not load administrator records, use Supabase, or save search results. The authenticated dashboard remains at `/admin`; if Supabase public configuration is absent, `/admin` and `/login` redirect to the demo rather than failing during session setup.

The demo uses Apify by default and keeps Meta Graph API as an explicitly selectable provider. Configure these server-side environment variables in Vercel:

- `APIFY_API_TOKEN` — Apify API token for the `apify/instagram-scraper` actor (required for the default provider).
- `INSTAGRAM_ACCESS_TOKEN` — optional Meta/Instagram Graph API access token with the required public-content permissions.
- `INSTAGRAM_USER_ID` — the Instagram professional account ID used for Meta hashtag discovery.
- `META_GRAPH_API_VERSION` — the supported Graph API version in `v<number>.<number>` format.

Do not prefix these variables with `NEXT_PUBLIC_`. Apify runs are capped at 30 posts (10 per gallery page), a 45-second actor timeout, and a $0.50 maximum actor charge per search. Load More reads the completed run's dataset and does not start another actor run; its encrypted cursor expires after 30 minutes. Set an overall spending limit in Apify as well. Only one matching search runs concurrently per server instance. Keep `.env.local` local; it is ignored by Git. Supabase variables are only needed for the separate administrator workspace:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### Deploy to Vercel

1. Import this repository into Vercel and keep the detected Next.js framework and `npm run build` build command.
2. Add `APIFY_API_TOKEN` in **Project Settings → Environment Variables** to enable the default provider. Add the optional Meta variables only if you intend to use Meta Graph API.
3. Ensure the Meta app and account have the required Instagram Graph API permissions and public-content access before selecting Meta.
4. Deploy or redeploy, then open the deployment root. It should show the public demo without Supabase variables.
5. Test a hashtag and confirm the API response includes public media before presenting. Instagram may omit or expire media URLs, and its hashtag-discovery quota is account-wide.

The public demo endpoint has a small in-memory per-client request limit. Vercel instances do not share that memory, so configure Vercel Firewall/rate limiting for `/api/demo/instagram/discover` before sharing the URL broadly. Do not treat the in-process limit as a global quota control.

## Dashboard behavior

- The admin dashboard reads posts, hashtag relationships, hashtags, and moderation activity from the existing Supabase tables using the signed-in administrator's session.
- After searching a hashtag in Hashtag Manager, administrators can open the returned recent Instagram results in Social Posts. These API results are temporary, read-only, and are not saved or moderated.
- Post totals use database counts. Platform distribution describes only the latest 100 loaded posts.
- Approve, Reject, and Remove use the additive `moderate_social_post` RPC to update `social_posts` and append an entry to `social_moderation_logs` in one transaction. Removing a post sets its status to `removed`; it does not delete the database row. Review `supabase/migrations/20261123002000_atomic_social_post_moderation.sql` before applying it manually.
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

The moderation RPC migration is additive and uses the caller's authenticated session with `SECURITY INVOKER`; it does not disable or bypass RLS. Review and apply it manually before using the updated moderation actions. To inspect the live hashtag update policies and grants without changing data, run `supabase/manual/diagnose-hashtag-update.sql` in the SQL Editor.

The live hashtag policy/grant reconciliation in `supabase/migrations/20261123005000_reconcile_social_hashtag_admin_access.sql` is also manual. Apply it only when its preflight confirms the admin SELECT policy is missing; it aborts if that policy name already exists. It preserves public active-hashtag SELECT access, adds allowlisted-admin SELECT access needed to manage inactive hashtags, and narrows hashtag table privileges to the dashboard's required operations. Review any other consumers of `social_hashtags` before applying it.

Run the project checks with:

```bash
npm run lint
npm test
npm run build
```

`npm test` runs isolated admin-mutation tests and read-only route smoke checks against `GRACE_SOCIAL_WALL_BASE_URL` (defaults to `http://localhost:3000`); route checks expect the app to be running. Mutation tests use a fake repository and do not sign in or change database records.
