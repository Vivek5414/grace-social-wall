import type {
  ActionResult,
  ApprovalStatus,
  ModerationActivity,
  SocialPlatform,
} from "@/types";

export interface HashtagRow {
  id: string;
  hashtag: string;
  is_active: boolean;
  created_at: string;
}

interface DatabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

interface DatabaseResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface ModerationRpcResult {
  post: {
    id: string;
    platform: SocialPlatform;
    author_name: string | null;
    caption: string | null;
    approval_status: ApprovalStatus;
    approved_at: string | null;
  };
  activity: {
    id: string;
    post_id: string;
    admin_user_id: string;
    action: ApprovalStatus;
    notes: string | null;
    created_at: string;
  };
}

export interface AdminMutationRepository {
  createHashtag(value: string): Promise<DatabaseResult<HashtagRow>>;
  updateHashtag(
    id: string,
    changes: { hashtag?: string; is_active?: boolean },
  ): Promise<DatabaseResult<HashtagRow>>;
  deleteHashtag(id: string): Promise<DatabaseResult<{ id: string }>>;
  moderatePost(
    id: string,
    status: "approved" | "rejected" | "removed",
  ): Promise<DatabaseResult<ModerationRpcResult>>;
}

interface AdminMutationDependencies {
  authorize: () => Promise<{ id: string }>;
  createRepository: () => Promise<AdminMutationRepository>;
  revalidate: () => void;
}

interface HashtagActionData {
  id: string;
  hashtag: string;
  isActive: boolean;
  createdAt: string;
}

interface ReviewActionData {
  id: string;
  approvalStatus: ApprovalStatus;
  approvedAt: string | null;
  activity: ModerationActivity;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function mapHashtag(row: HashtagRow): HashtagActionData {
  return {
    id: row.id,
    hashtag: row.hashtag,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function isApprovalStatus(value: string): value is ApprovalStatus {
  return ["pending", "approved", "rejected", "removed"].includes(value);
}

function isSocialPlatform(value: string): value is SocialPlatform {
  return ["instagram", "facebook", "x", "linkedin"].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function logDatabaseError(
  context: string,
  error: DatabaseError | null,
  metadata?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "development" && error) {
    console.error(`[admin dashboard] ${context}:`, {
      ...metadata,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  } else {
    console.error(`[admin dashboard] ${context}.`);
  }
}

function mapModerationResult(
  result: ModerationRpcResult,
): ReviewActionData | null {
  if (!isRecord(result)) return null;
  const { post, activity } = result;
  if (
    !isRecord(post) ||
    !isRecord(activity) ||
    !isValidUuid(post.id) ||
    !isValidUuid(activity.id) ||
    !isValidUuid(activity.post_id) ||
    !isValidUuid(activity.admin_user_id) ||
    !isApprovalStatus(post.approval_status) ||
    !isApprovalStatus(activity.action) ||
    !isSocialPlatform(post.platform) ||
    !isNullableString(post.author_name) ||
    !isNullableString(post.caption) ||
    !isNullableString(post.approved_at) ||
    !isNullableString(activity.notes) ||
    typeof activity.created_at !== "string" ||
    activity.post_id !== post.id
  ) {
    return null;
  }

  const summary = [
    post.author_name?.trim() || "Unknown author",
    post.caption?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: post.id,
    approvalStatus: post.approval_status,
    approvedAt: post.approved_at,
    activity: {
      id: activity.id,
      postId: activity.post_id,
      postPlatform: post.platform,
      postSummary: summary,
      adminUserId: activity.admin_user_id,
      action: activity.action,
      notes: activity.notes,
      createdAt: activity.created_at,
    },
  };
}

export function createAdminMutationActions(
  dependencies: AdminMutationDependencies,
) {
  return {
    async createHashtagAction(
      value: string,
    ): Promise<ActionResult<HashtagActionData>> {
      await dependencies.authorize();
      if (typeof value !== "string") {
        return { success: false, message: "Enter a hashtag of 1–100 characters." };
      }

      const hashtag = value.trim();
      if (!hashtag || hashtag.length > 100) {
        return { success: false, message: "Enter a hashtag of 1–100 characters." };
      }

      const repository = await dependencies.createRepository();
      const { data, error } = await repository.createHashtag(hashtag);
      if (error || !data) {
        logDatabaseError("Failed to create hashtag", error);
        return {
          success: false,
          message:
            error?.code === "23505"
              ? "That hashtag already exists."
              : "The hashtag could not be added.",
        };
      }

      dependencies.revalidate();
      return { success: true, message: "Hashtag added.", data: mapHashtag(data) };
    },

    async updateHashtagAction(
      id: string,
      value: string,
    ): Promise<ActionResult<HashtagActionData>> {
      await dependencies.authorize();
      if (typeof value !== "string") {
        return {
          success: false,
          message: "Enter a valid hashtag of 1–100 characters.",
        };
      }

      const hashtag = value.trim();
      if (!isValidUuid(id) || !hashtag || hashtag.length > 100) {
        return {
          success: false,
          message: "Enter a valid hashtag of 1–100 characters.",
        };
      }

      const repository = await dependencies.createRepository();
      const { data, error } = await repository.updateHashtag(id, { hashtag });
      if (error || !data) {
        logDatabaseError("Failed to update hashtag", error);
        return {
          success: false,
          message:
            error?.code === "23505"
              ? "That hashtag already exists."
              : "The hashtag could not be updated.",
        };
      }

      dependencies.revalidate();
      return {
        success: true,
        message: "Hashtag updated.",
        data: mapHashtag(data),
      };
    },

    async setHashtagActiveAction(
      id: string,
      isActive: boolean,
    ): Promise<ActionResult<HashtagActionData>> {
      await dependencies.authorize();
      if (!isValidUuid(id) || typeof isActive !== "boolean") {
        return { success: false, message: "Invalid hashtag status request." };
      }

      const repository = await dependencies.createRepository();
      const { data, error } = await repository.updateHashtag(id, {
        is_active: isActive,
      });
      if (error || !data) {
        logDatabaseError("Failed to update hashtag status", error, {
          hashtagId: id,
          requestedIsActive: isActive,
        });
        return {
          success: false,
          message: "The hashtag status could not be updated.",
        };
      }

      dependencies.revalidate();
      return {
        success: true,
        message: isActive ? "Hashtag activated." : "Hashtag deactivated.",
        data: mapHashtag(data),
      };
    },

    async deleteHashtagAction(
      id: string,
    ): Promise<ActionResult<{ id: string }>> {
      await dependencies.authorize();
      if (!isValidUuid(id)) {
        return { success: false, message: "Invalid hashtag." };
      }

      const repository = await dependencies.createRepository();
      const { data, error } = await repository.deleteHashtag(id);
      if (error || !data) {
        logDatabaseError("Failed to delete hashtag", error);
        return {
          success: false,
          message:
            error?.code === "23503"
              ? "This hashtag is attached to posts. Deactivate it instead."
              : "The hashtag could not be deleted.",
        };
      }

      dependencies.revalidate();
      return {
        success: true,
        message: "Hashtag deleted.",
        data: { id: data.id },
      };
    },

    async reviewPostAction(
      postId: string,
      status: "approved" | "rejected" | "removed",
    ): Promise<ActionResult<ReviewActionData>> {
      await dependencies.authorize();
      if (
        !isValidUuid(postId) ||
        (status !== "approved" &&
          status !== "rejected" &&
          status !== "removed")
      ) {
        return { success: false, message: "Invalid moderation request." };
      }

      const repository = await dependencies.createRepository();
      const { data, error } = await repository.moderatePost(postId, status);
      const mapped = data ? mapModerationResult(data) : null;
      if (
        error ||
        !mapped ||
        mapped.approvalStatus !== status ||
        mapped.activity.action !== status ||
        mapped.activity.postId !== postId
      ) {
        logDatabaseError("Failed to moderate post", error);
        return {
          success: false,
          message: "The post could not be updated. Check access and try again.",
        };
      }

      dependencies.revalidate();
      return {
        success: true,
        message:
          status === "approved"
            ? "Post approved."
            : status === "rejected"
              ? "Post rejected."
              : "Post removed from the social wall.",
        data: mapped,
      };
    },
  };
}
