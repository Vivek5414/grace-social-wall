"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  ApprovalStatus,
  ModerationActivity,
  PostMediaAttachment,
  SocialHashtag,
  SocialPlatform,
} from "@/types";

const PRIVATE_MEDIA_BUCKET = "grace-social-wall-media";

type ReviewResult = {
  id: string;
  approvalStatus: ApprovalStatus;
  approvedAt: string | null;
  activity: ModerationActivity | null;
};

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function mapHashtag(row: {
  id: string;
  hashtag: string;
  is_active: boolean;
  created_at: string;
}): SocialHashtag {
  return {
    id: row.id,
    hashtag: row.hashtag,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function reviewPostAction(
  postId: string,
  status: "approved" | "rejected" | "removed",
): Promise<ActionResult<ReviewResult>> {
  const user = await requireAdmin();
  if (
    !validId(postId) ||
    (status !== "approved" && status !== "rejected" && status !== "removed")
  ) {
    return { success: false, message: "Invalid moderation request." };
  }

  const supabase = await createClient();
  const approvedAt = status === "approved" ? new Date().toISOString() : null;
  const { data: post, error } = await supabase
    .from("social_posts")
    .update({ approval_status: status, approved_at: approvedAt })
    .eq("id", postId)
    .select("id, platform, author_name, caption, approval_status, approved_at")
    .maybeSingle();

  if (error || !post) {
    console.error("[admin dashboard] Failed to moderate post:", error);
    return { success: false, message: "The post could not be updated. Check access and try again." };
  }

  const { data: log, error: logError } = await supabase
    .from("social_moderation_logs")
    .insert({
      post_id: postId,
      action: status,
      admin_user_id: user.id,
    })
    .select("id, post_id, admin_user_id, action, notes, created_at")
    .single();

  if (logError) {
    console.error("[admin dashboard] Failed to save moderation log:", logError);
  }

  revalidatePath("/admin");

  return {
    success: true,
    message:
      status === "approved"
        ? "Post approved."
        : status === "rejected"
          ? "Post rejected."
          : "Post removed from the social wall.",
    data: {
      id: post.id,
      approvalStatus: post.approval_status as ApprovalStatus,
      approvedAt: post.approved_at,
      activity: log
        ? {
            id: log.id,
            postId: log.post_id,
            postPlatform: post.platform as SocialPlatform,
            postSummary: [
              post.author_name?.trim() || "Unknown author",
              post.caption?.trim(),
            ]
              .filter(Boolean)
              .join(" · "),
            adminUserId: log.admin_user_id,
            action: log.action,
            notes: log.notes,
            createdAt: log.created_at,
          }
        : null,
    },
    ...(logError
      ? {
          warning: "The post status changed, but the moderation log could not be saved.",
        }
      : {}),
  };
}

export async function createHashtagAction(
  value: string,
): Promise<ActionResult<SocialHashtag>> {
  await requireAdmin();
  if (typeof value !== "string") {
    return { success: false, message: "Enter a hashtag of 1–100 characters." };
  }
  const hashtag = value.trim();
  if (!hashtag || hashtag.length > 100) {
    return { success: false, message: "Enter a hashtag of 1–100 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_hashtags")
    .insert({ hashtag, is_active: true })
    .select("id, hashtag, is_active, created_at")
    .single();

  if (error || !data) {
    console.error("[admin dashboard] Failed to create hashtag:", error);
    return {
      success: false,
      message: error?.code === "23505" ? "That hashtag already exists." : "The hashtag could not be added.",
    };
  }

  revalidatePath("/admin");
  return { success: true, message: "Hashtag added.", data: mapHashtag(data) };
}

export async function updateHashtagAction(
  id: string,
  value: string,
): Promise<ActionResult<SocialHashtag>> {
  await requireAdmin();
  if (typeof value !== "string") {
    return { success: false, message: "Enter a valid hashtag of 1–100 characters." };
  }
  const hashtag = value.trim();
  if (!validId(id) || !hashtag || hashtag.length > 100) {
    return { success: false, message: "Enter a valid hashtag of 1–100 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_hashtags")
    .update({ hashtag })
    .eq("id", id)
    .select("id, hashtag, is_active, created_at")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin dashboard] Failed to update hashtag:", error);
    return {
      success: false,
      message: error?.code === "23505" ? "That hashtag already exists." : "The hashtag could not be updated.",
    };
  }

  revalidatePath("/admin");
  return { success: true, message: "Hashtag updated.", data: mapHashtag(data) };
}

export async function setHashtagActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult<SocialHashtag>> {
  await requireAdmin();
  if (!validId(id) || typeof isActive !== "boolean") {
    return { success: false, message: "Invalid hashtag status request." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_hashtags")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id, hashtag, is_active, created_at")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin dashboard] Failed to update hashtag status:", error);
    return { success: false, message: "The hashtag status could not be updated." };
  }

  revalidatePath("/admin");
  return {
    success: true,
    message: isActive ? "Hashtag activated." : "Hashtag deactivated.",
    data: mapHashtag(data),
  };
}

export async function deleteHashtagAction(id: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!validId(id)) return { success: false, message: "Invalid hashtag." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_hashtags")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin dashboard] Failed to delete hashtag:", error);
    return {
      success: false,
      message:
        error?.code === "23503"
          ? "This hashtag is attached to posts. Deactivate it instead."
          : "The hashtag could not be deleted.",
    };
  }

  revalidatePath("/admin");
  return { success: true, message: "Hashtag deleted.", data: { id: data.id } };
}

export async function listPostMediaAction(
  postId: string,
): Promise<ActionResult<PostMediaAttachment[]>> {
  await requireAdmin();
  if (!validId(postId)) {
    return { success: false, message: "Invalid post reference." };
  }

  const supabase = await createClient();
  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();

  if (postError || !post) {
    console.error("[admin dashboard] Failed to verify media post:", postError);
    return { success: false, message: "The post could not be verified for media access." };
  }

  const { data: files, error: listError } = await supabase.storage
    .from(PRIVATE_MEDIA_BUCKET)
    .list(postId, { limit: 50, sortBy: { column: "created_at", order: "desc" } });

  if (listError) {
    console.error("[admin dashboard] Failed to list private post media:", listError);
    return {
      success: false,
      message: "Private media is unavailable. Verify the Grace Social Wall media migration and access.",
    };
  }

  const attachments: PostMediaAttachment[] = [];
  for (const file of files) {
    if (!file.id) continue;

    const path = `${postId}/${file.name}`;
    const { data, error } = await supabase.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      console.error("[admin dashboard] Failed to sign private post media:", error);
      return { success: false, message: "A private media file could not be opened." };
    }

    attachments.push({ name: file.name, url: data.signedUrl });
  }

  return { success: true, message: "Private media loaded.", data: attachments };
}
