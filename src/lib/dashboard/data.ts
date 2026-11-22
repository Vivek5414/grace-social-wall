import "server-only";

import { isLocalDevelopmentAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ApprovalStatus,
  DashboardData,
  ModerationActivity,
  SocialHashtag,
  SocialPlatform,
  SocialPost,
} from "@/types";

const POST_LIMIT = 100;
const POST_COLUMNS =
  "id, platform, author_name, author_username, caption, post_url, media_type, media_url, posted_at, approval_status, approved_at, created_at";

interface PostRow {
  id: string;
  platform: string;
  author_name: string | null;
  author_username: string | null;
  caption: string | null;
  post_url: string | null;
  media_type: string | null;
  media_url: string | null;
  posted_at: string | null;
  approval_status: string;
  approved_at: string | null;
  created_at: string;
}

interface PostHashtagRow {
  post_id: string;
  social_hashtags: { hashtag: string } | { hashtag: string }[] | null;
}

interface HashtagRow {
  id: string;
  hashtag: string;
  is_active: boolean;
  created_at: string;
}

interface ActivityRow {
  id: string;
  post_id: string | null;
  admin_user_id: string | null;
  action: string;
  notes: string | null;
  created_at: string;
  social_posts:
    | {
        platform: string;
        author_name: string | null;
        caption: string | null;
      }
    | {
        platform: string;
        author_name: string | null;
        caption: string | null;
      }[]
    | null;
}

const platformList: SocialPlatform[] = ["instagram", "facebook", "x", "linkedin"];
const platforms = new Set<SocialPlatform>(platformList);
const statuses = new Set<ApprovalStatus>(["pending", "approved", "rejected", "removed"]);

function isPlatform(value: string): value is SocialPlatform {
  return platforms.has(value as SocialPlatform);
}

function isApprovalStatus(value: string): value is ApprovalStatus {
  return statuses.has(value as ApprovalStatus);
}

function mapPosts(rows: PostRow[], hashtagsByPost: Map<string, string[]>): SocialPost[] {
  return rows.flatMap((row) => {
    if (!isPlatform(row.platform) || !isApprovalStatus(row.approval_status)) {
      console.error("[admin dashboard] Ignoring a post with an unsupported platform or status.", {
        postId: row.id,
        platform: row.platform,
        status: row.approval_status,
      });
      return [];
    }

    return [{
      id: row.id,
      platform: row.platform,
      authorName: row.author_name?.trim() || "Unknown author",
      authorUsername: row.author_username?.trim() || "",
      caption: row.caption?.trim() || "",
      postUrl: row.post_url,
      mediaType: row.media_type,
      mediaUrl: row.media_url,
      postedAt: row.posted_at,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      approvalStatus: row.approval_status,
      hashtags: hashtagsByPost.get(row.id) ?? [],
    }];
  });
}

export async function getAdminDashboardData(): Promise<DashboardData> {
  if (isLocalDevelopmentAuthBypassEnabled()) {
    const bypassMessage =
      "Local development bypass is active. Sign in as an allowlisted administrator to load protected Supabase records.";

    return {
      posts: [],
      pendingPosts: [],
      publishedPosts: [],
      hashtags: [],
      activities: [],
      activityCount: null,
      platformCounts: {
        instagram: null,
        facebook: null,
        x: null,
        linkedin: null,
      },
      counts: {
        total: null,
        pending: null,
        approved: null,
        rejected: null,
      },
      adminProfile: null,
      developmentBypass: true,
      errors: {
        posts: bypassMessage,
        queue: bypassMessage,
        published: bypassMessage,
        counts: bypassMessage,
        hashtags: bypassMessage,
        activities: bypassMessage,
        postHashtags: bypassMessage,
        platformCounts: bypassMessage,
      },
    };
  }

  const adminUser = await requireAdmin();
  const supabase = await createClient();
  const errors: DashboardData["errors"] = {};

  const [
    postsResult,
    pendingCountResult,
    pendingPostsResult,
    approvedCountResult,
    rejectedCountResult,
    publishedPostsResult,
    hashtagsResult,
    activitiesResult,
    ...platformCountResults
  ] = await Promise.all([
    supabase
      .from("social_posts")
      .select(POST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(POST_LIMIT),
    supabase
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    supabase
      .from("social_posts")
      .select(POST_COLUMNS)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false })
      .limit(POST_LIMIT),
    supabase
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved"),
    supabase
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "rejected"),
    supabase
      .from("social_posts")
      .select(POST_COLUMNS)
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false })
      .limit(POST_LIMIT),
    supabase
      .from("social_hashtags")
      .select("id, hashtag, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("social_moderation_logs")
      .select(
        "id, post_id, admin_user_id, action, notes, created_at, social_posts ( platform, author_name, caption )",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(100),
    ...platformList.map((platform) =>
      supabase
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("platform", platform),
    ),
  ]);

  if (postsResult.error) {
    console.error("[admin dashboard] Failed to load social posts:", postsResult.error);
    errors.posts = "Posts could not be loaded. Verify the social moderation migration and database access.";
  }
  if (pendingCountResult.error) {
    console.error("[admin dashboard] Failed to count pending posts:", pendingCountResult.error);
  }
  if (pendingPostsResult.error) {
    console.error("[admin dashboard] Failed to load the moderation queue:", pendingPostsResult.error);
    errors.queue = "The moderation queue could not be loaded.";
  }
  if (approvedCountResult.error) {
    console.error("[admin dashboard] Failed to count approved posts:", approvedCountResult.error);
  }
  if (rejectedCountResult.error) {
    console.error("[admin dashboard] Failed to count rejected posts:", rejectedCountResult.error);
  }
  if (publishedPostsResult.error) {
    console.error("[admin dashboard] Failed to load published posts:", publishedPostsResult.error);
    errors.published = "Published posts could not be loaded.";
  }
  if (pendingCountResult.error || approvedCountResult.error || rejectedCountResult.error) {
    errors.counts = "Some post totals could not be loaded.";
  }
  const failedPlatforms = platformCountResults.flatMap((result, index) =>
    result.error ? [{ platform: platformList[index], error: result.error }] : [],
  );
  if (failedPlatforms.length > 0) {
    errors.platformCounts = "Platform statistics could not be loaded.";
    console.error("[admin dashboard] Failed to load platform totals:", failedPlatforms);
  }
  if (hashtagsResult.error) {
    console.error("[admin dashboard] Failed to load hashtags:", hashtagsResult.error);
    errors.hashtags = "Hashtags could not be loaded. Verify administrator access and the moderation migration.";
  }
  if (activitiesResult.error) {
    console.error("[admin dashboard] Failed to load moderation activity:", activitiesResult.error);
    errors.activities = "Recent moderation activity could not be loaded.";
  }

  const postRows = (postsResult.data ?? []) as PostRow[];
  const pendingRows = (pendingPostsResult.data ?? []) as PostRow[];
  const publishedRows = (publishedPostsResult.data ?? []) as PostRow[];
  const postIds = Array.from(
    new Set([...postRows, ...pendingRows, ...publishedRows].map((post) => post.id)),
  );
  const hashtagsByPost = new Map<string, string[]>();

  if (postIds.length > 0) {
    const relationshipsResult = await supabase
      .from("social_post_hashtags")
      .select("post_id, social_hashtags ( hashtag )")
      .in("post_id", postIds);

    if (relationshipsResult.error) {
      console.error("[admin dashboard] Failed to load post hashtags:", relationshipsResult.error);
      errors.postHashtags = "Post hashtag associations could not be loaded.";
    } else {
      for (const row of (relationshipsResult.data ?? []) as PostHashtagRow[]) {
        const relation = Array.isArray(row.social_hashtags)
          ? row.social_hashtags[0]
          : row.social_hashtags;
        if (!relation) continue;

        const values = hashtagsByPost.get(row.post_id) ?? [];
        values.push(relation.hashtag);
        hashtagsByPost.set(row.post_id, values);
      }
    }
  }

  const hashtags: SocialHashtag[] = ((hashtagsResult.data ?? []) as HashtagRow[]).map((row) => ({
    id: row.id,
    hashtag: row.hashtag,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
  const activities: ModerationActivity[] = (
    (activitiesResult.data ?? []) as ActivityRow[]
  ).map((row) => {
    const relatedPost = Array.isArray(row.social_posts)
      ? row.social_posts[0]
      : row.social_posts;
    const postSummary = relatedPost
      ? [
          relatedPost.author_name?.trim() || "Unknown author",
          relatedPost.caption?.trim(),
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    return {
      id: row.id,
      postId: row.post_id,
      postPlatform:
        relatedPost && isPlatform(relatedPost.platform) ? relatedPost.platform : null,
      postSummary,
      adminUserId: row.admin_user_id,
      action: row.action,
      notes: row.notes,
      createdAt: row.created_at,
    };
  });
  const platformCounts = Object.fromEntries(
    platformList.map((platform, index) => {
      const result = platformCountResults[index];
      return [platform, result.error ? null : result.count];
    }),
  ) as Record<SocialPlatform, number | null>;

  return {
    posts: mapPosts(postRows, hashtagsByPost),
    pendingPosts: mapPosts(pendingRows, hashtagsByPost),
    publishedPosts: mapPosts(publishedRows, hashtagsByPost),
    hashtags,
    activities,
    activityCount: activitiesResult.error ? null : activitiesResult.count,
    platformCounts,
    counts: {
      total: postsResult.error ? null : postsResult.count,
      pending: pendingCountResult.error ? null : pendingCountResult.count,
      approved: approvedCountResult.error ? null : approvedCountResult.count,
      rejected: rejectedCountResult.error ? null : rejectedCountResult.count,
    },
    adminProfile: {
      id: adminUser.id,
      email: adminUser.email ?? null,
    },
    developmentBypass: false,
    errors,
  };
}
