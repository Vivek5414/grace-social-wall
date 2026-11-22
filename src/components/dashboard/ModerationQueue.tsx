"use client";

import { ArrowUpRight, Check, Clock3, Hash } from "lucide-react";
import type { SocialPost } from "@/types";
import PlatformBadge from "@/components/dashboard/PlatformBadge";
import ModerationControls from "@/components/dashboard/ModerationControls";
import PanelHeading from "@/components/dashboard/PanelHeading";
import PostPreviewPlaceholder from "@/components/dashboard/PostPreviewPlaceholder";
import { formatDateTime } from "@/lib/format-date";
import { getSafeExternalUrl } from "@/lib/external-url";

interface ModerationQueueProps {
  posts: SocialPost[];
  loadedCount: number;
  totalCount: number | null;
  processingId: string | null;
  onReview: (id: string, status: "approved" | "rejected" | "removed") => Promise<void>;
  emptyMessage?: string;
  previewMode?: boolean;
}

export default function ModerationQueue({
  posts,
  loadedCount,
  totalCount,
  processingId,
  onReview,
  emptyMessage = "There are no posts waiting for review.",
  previewMode = false,
}: ModerationQueueProps) {
  return (
    <section className="content-panel" aria-label="Moderation queue">
      <PanelHeading
        title="Moderation queue"
        description="Review posts that are waiting for administrator approval."
        action={<span className="submissions-total">{totalCount ?? posts.length} pending</span>}
      />
      {totalCount !== null && totalCount > loadedCount && (
        <p className="notice-banner warning queue-limit-note">
          Showing the latest {loadedCount} of {totalCount} pending posts.
        </p>
      )}
      {posts.length === 0 ? (
        <>
          <div className="empty-state-block">
            <span className="empty-icon"><Check size={20} aria-hidden="true" /></span>
            <h3>
              {previewMode
                ? "Moderation preview"
                : totalCount
                  ? "No matching posts"
                  : "Queue is clear"}
            </h3>
            <p>{emptyMessage}</p>
          </div>
          {previewMode && <PostPreviewPlaceholder showModerationActions />}
        </>
      ) : (
        <div className="moderation-list">
          {posts.map((post) => (
            <article className="moderation-card" key={post.id}>
              <div className="moderation-card-header">
                <div className="moderation-author">
                  <span className="post-avatar" aria-hidden="true">
                    {post.authorName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{post.authorName}</strong>
                    <span>{post.authorUsername || "Username unavailable"}</span>
                  </div>
                </div>
                <PlatformBadge platform={post.platform} />
              </div>

              <div className="moderation-caption">
                {post.caption || <span className="muted-copy">No caption provided.</span>}
              </div>

              {post.hashtags.length > 0 && (
                <div className="post-hashtags">
                  <Hash size={14} aria-hidden="true" />
                  {post.hashtags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}

              <div className="moderation-meta">
                <span><Clock3 size={14} aria-hidden="true" />Submitted {formatDateTime(post.createdAt)}</span>
                {post.mediaType && <span>{post.mediaType.replaceAll("_", " ")}</span>}
                {getSafeExternalUrl(post.postUrl) && (
                  <a href={getSafeExternalUrl(post.postUrl) ?? undefined} target="_blank" rel="noreferrer">
                    Preview original <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                )}
              </div>

              {getSafeExternalUrl(post.mediaUrl) && (
                <a className="media-link" href={getSafeExternalUrl(post.mediaUrl) ?? undefined} target="_blank" rel="noreferrer">
                  Open submitted media
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              )}

              <ModerationControls
                post={post}
                processing={processingId !== null}
                previewMode={previewMode}
                onReview={onReview}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
