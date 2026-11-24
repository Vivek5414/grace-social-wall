"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import {
  createAdminMutationActions,
  isValidUuid,
  type AdminMutationRepository,
  type HashtagRow,
  type ModerationRpcResult,
} from "@/lib/admin/mutations";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  PostMediaAttachment,
} from "@/types";

const PRIVATE_MEDIA_BUCKET = "grace-social-wall-media";

function getAdminMutationActions() {
  return createAdminMutationActions({
    authorize: requireAdmin,
    createRepository: async (): Promise<AdminMutationRepository> => {
      const supabase = await createClient();
      return {
        async createHashtag(value) {
          const { data, error } = await supabase
            .from("social_hashtags")
            .insert({ hashtag: value, is_active: true })
            .select("id, hashtag, is_active, created_at")
            .single();
          return { data: data as HashtagRow | null, error };
        },
        async updateHashtag(id, changes) {
          const { data, error } = await supabase
            .from("social_hashtags")
            .update(changes)
            .eq("id", id)
            .select("id, hashtag, is_active, created_at")
            .maybeSingle();
          return { data: data as HashtagRow | null, error };
        },
        async deleteHashtag(id) {
          const { data, error } = await supabase
            .from("social_hashtags")
            .delete()
            .eq("id", id)
            .select("id")
            .maybeSingle();
          return { data, error };
        },
        async moderatePost(id, status) {
          const { data, error } = await supabase.rpc("moderate_social_post", {
            p_post_id: id,
            p_action: status,
          });
          return {
            data: data as ModerationRpcResult | null,
            error,
          };
        },
      };
    },
    revalidate: () => revalidatePath("/admin"),
  });
}

export async function reviewPostAction(
  postId: string,
  status: "approved" | "rejected" | "removed",
) {
  return getAdminMutationActions().reviewPostAction(postId, status);
}

export async function createHashtagAction(value: string) {
  return getAdminMutationActions().createHashtagAction(value);
}

export async function updateHashtagAction(id: string, value: string) {
  return getAdminMutationActions().updateHashtagAction(id, value);
}

export async function setHashtagActiveAction(id: string, isActive: boolean) {
  return getAdminMutationActions().setHashtagActiveAction(id, isActive);
}

export async function deleteHashtagAction(id: string) {
  return getAdminMutationActions().deleteHashtagAction(id);
}

export async function listPostMediaAction(
  postId: string,
): Promise<ActionResult<PostMediaAttachment[]>> {
  await requireAdmin();
  if (!isValidUuid(postId)) {
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
