export type SocialPlatform = "instagram" | "facebook" | "x" | "linkedin";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "removed";

export type DashboardSection =
  | "Overview"
  | "Social Posts"
  | "Moderation Queue"
  | "Published Posts"
  | "Hashtag Manager"
  | "Activity Logs"
  | "Social Integrations"
  | "Sync Logs"
  | "Settings";

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  authorName: string;
  authorUsername: string;
  caption: string;
  postUrl: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  postedAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvalStatus: ApprovalStatus;
  hashtags: string[];
}

export interface PostMediaAttachment {
  name: string;
  url: string;
}

export interface SocialHashtag {
  id: string;
  hashtag: string;
  isActive: boolean;
  createdAt: string;
}

export interface ModerationActivity {
  id: string;
  postId: string | null;
  postPlatform: SocialPlatform | null;
  postSummary: string | null;
  adminUserId: string | null;
  action: string;
  notes: string | null;
  createdAt: string;
}

export interface AdminProfile {
  id: string;
  email: string | null;
}

export interface DashboardCounts {
  total: number | null;
  pending: number | null;
  approved: number | null;
  rejected: number | null;
}

export interface DashboardData {
  posts: SocialPost[];
  pendingPosts: SocialPost[];
  publishedPosts: SocialPost[];
  hashtags: SocialHashtag[];
  activities: ModerationActivity[];
  activityCount: number | null;
  platformCounts: Record<SocialPlatform, number | null>;
  counts: DashboardCounts;
  adminProfile: AdminProfile | null;
  developmentBypass: boolean;
  errors: {
    posts?: string;
    queue?: string;
    published?: string;
    counts?: string;
    hashtags?: string;
    activities?: string;
    postHashtags?: string;
    platformCounts?: string;
  };
}

export type ActionResult<T> =
  | { success: true; message: string; data: T; warning?: string }
  | { success: false; message: string };
