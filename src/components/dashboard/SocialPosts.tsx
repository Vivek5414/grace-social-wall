"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Camera,
  Eye,
  Hash,
  Search,
  X,
} from "lucide-react";
import type { ApprovalStatus, SocialPlatform, SocialPost } from "@/types";
import PanelHeading from "@/components/dashboard/PanelHeading";
import ModerationControls from "@/components/dashboard/ModerationControls";
import PlatformBadge from "@/components/dashboard/PlatformBadge";
import PostMediaManager from "@/components/dashboard/PostMediaManager";
import PostPreviewPlaceholder from "@/components/dashboard/PostPreviewPlaceholder";
import { formatDateTime } from "@/lib/format-date";
import { getSafeExternalUrl } from "@/lib/external-url";
import InstagramMediaCard from "@/components/dashboard/InstagramMediaCard";
import type { InstagramRecentFeedResult } from "@/lib/instagram/graph-api";

type PlatformFilter = "all" | SocialPlatform;
type StatusFilter = "all" | ApprovalStatus;

interface SocialPostsProps {
  posts: SocialPost[];
  totalCount: number | null;
  search: string;
  loadError?: string;
  previewMode: boolean;
  processingId: string | null;
  recentInstagramFeed: InstagramRecentFeedResult | null;
  onSearchChange: (value: string) => void;
  onReview: (id: string, status: "approved" | "rejected" | "removed") => Promise<void>;
}

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  removed: "Removed",
};

const platformLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  linkedin: "LinkedIn",
};

function isSocialPlatform(value: string): value is SocialPlatform {
  return Object.prototype.hasOwnProperty.call(platformLabels, value);
}

function isApprovalStatus(value: string): value is ApprovalStatus {
  return Object.prototype.hasOwnProperty.call(statusLabels, value);
}

export default function SocialPosts({
  posts,
  totalCount,
  search,
  loadError,
  previewMode,
  processingId,
  recentInstagramFeed,
  onSearchChange,
  onReview,
}: SocialPostsProps) {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          (platformFilter === "all" || post.platform === platformFilter) &&
          (statusFilter === "all" || post.approvalStatus === statusFilter),
      ),
    [posts, platformFilter, statusFilter],
  );

  return (
    <>
      {recentInstagramFeed && (
        <section
          className="content-panel instagram-recent-feed"
          aria-label="Recent Instagram posts"
        >
          <PanelHeading
            title="Recent Instagram posts"
            description={`Temporary live results for #${recentInstagramFeed.hashtag}. They are not saved to Supabase or available for moderation.`}
            action={
              <span className="submissions-total">
                {recentInstagramFeed.posts.length} recent
              </span>
            }
          />
          {recentInstagramFeed.posts.length > 0 ? (
            <div className="instagram-result-grid">
              {recentInstagramFeed.posts.map((post) => (
                <InstagramMediaCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="empty-state instagram-discovery-empty" role="status">
              No recent public posts are available for this hashtag.
            </p>
          )}
        </section>
      )}
      <section className="content-panel social-posts-panel" aria-label="Social posts">
        <PanelHeading
          title="Social posts"
          description="Search and review posts recorded in your workspace."
          action={
            <span className="submissions-total">
              {previewMode
                ? "Developer Preview"
                : totalCount === null
                  ? "Total unavailable"
                  : `${totalCount.toLocaleString()} total`}
            </span>
          }
        />

        {!previewMode && loadError && <p className="inline-error" role="alert">{loadError}</p>}

        <div className="social-posts-toolbar">
          <label className="social-posts-search" htmlFor="social-posts-search">
            <Search size={15} aria-hidden="true" />
            <input
              id="social-posts-search"
              type="search"
              value={search}
              aria-label="Search posts, authors, or hashtags"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search posts, authors, or hashtags"
            />
          </label>
          <label className="social-filter-field" htmlFor="social-platform-filter">
            <span>Platform</span>
            <select
              id="social-platform-filter"
              value={platformFilter}
              onChange={(event) => {
                const value = event.target.value;
                setPlatformFilter(value === "all" || isSocialPlatform(value) ? value : "all");
              }}
            >
              <option value="all">All platforms</option>
              {Object.entries(platformLabels).map(([platform, label]) => (
                <option key={platform} value={platform}>{label}</option>
              ))}
            </select>
          </label>
          <label className="social-filter-field" htmlFor="social-status-filter">
            <span>Status</span>
            <select
              id="social-status-filter"
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                setStatusFilter(value === "all" || isApprovalStatus(value) ? value : "all");
              }}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </label>
          <span className="social-posts-result-count" aria-live="polite">
            {filteredPosts.length} shown
          </span>
        </div>

        {filteredPosts.length > 0 ? (
          <div className="post-card-grid">
            {filteredPosts.map((post) => (
              <article className="social-post-card" key={post.id}>
                <header className="social-post-card-header">
                  <div className="post-card-author">
                    <span className="post-avatar" aria-hidden="true">
                      {post.authorName.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{post.authorName}</strong>
                      <small>{post.authorUsername || "Username unavailable"}</small>
                    </span>
                  </div>
                  <span className={`status-badge status-${post.approvalStatus}`}>
                    {statusLabels[post.approvalStatus]}
                  </span>
                </header>
                <div className="post-card-platform">
                  <PlatformBadge platform={post.platform} />
                  <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
                </div>
                <div className="post-card-media-placeholder">
                  <Camera size={19} aria-hidden="true" />
                  <span>
                    {post.mediaType
                      ? `${post.mediaType.replaceAll("_", " ")} preview`
                      : "No media attached"}
                  </span>
                </div>
                <p className="post-card-caption">
                  {post.caption || "No caption provided."}
                </p>
                {post.hashtags.length > 0 && (
                  <div className="post-preview-hashtags">
                    <Hash size={14} aria-hidden="true" />
                    {post.hashtags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                )}
                <footer className="social-post-card-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPreviewPost(post)}
                  >
                    <Eye size={14} aria-hidden="true" />
                    Post details
                  </button>
                  {post.approvalStatus !== "removed" && (
                    <ModerationControls
                      post={post}
                      processing={processingId !== null}
                      previewMode={previewMode}
                      onReview={onReview}
                    />
                  )}
                </footer>
              </article>
            ))}
          </div>
        ) : previewMode ? (
          <div className="preview-empty-layout">
            <p className="empty-state">
              Filters and search are ready. Post records are not loaded in Developer Preview.
            </p>
            <PostPreviewPlaceholder showModerationActions />
          </div>
        ) : (
          <p className="empty-state">
            {loadError
              ? "Post records are unavailable."
              : totalCount === 0
                ? "No posts have been submitted yet."
                : "No posts match the current search and filters."}
          </p>
        )}

        <div className="table-footnote">
          {totalCount !== null && totalCount > posts.length
            ? `Showing the latest ${posts.length} of ${totalCount} posts. `
            : ""}
          {previewMode
            ? "No post records or media are loaded in Developer Preview."
            : "Post records and moderation status come from the database."}
        </div>
      </section>

      {previewPost && (
        <div
          className="modal-backdrop post-preview-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewPost(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setPreviewPost(null);
          }}
        >
          <section
            className="integration-dialog post-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-preview-title"
          >
            <button
              type="button"
              className="icon-button dialog-close"
              aria-label="Close post preview"
              onClick={() => setPreviewPost(null)}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <div className="post-preview-heading">
              <span className="post-avatar" aria-hidden="true">
                {previewPost.authorName.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h2 id="post-preview-title">{previewPost.authorName}</h2>
                <p>{previewPost.authorUsername || "Username unavailable"}</p>
              </div>
            </div>
            <div className="post-preview-meta">
              <PlatformBadge platform={previewPost.platform} />
              <span className={`status-badge status-${previewPost.approvalStatus}`}>
                {statusLabels[previewPost.approvalStatus]}
              </span>
              <time dateTime={previewPost.createdAt}>{formatDateTime(previewPost.createdAt)}</time>
            </div>
            <p className="post-preview-caption">
              {previewPost.caption || "No caption was provided for this post."}
            </p>
            {previewPost.hashtags.length > 0 && (
              <div className="post-preview-hashtags">
                <Hash size={14} aria-hidden="true" />
                {previewPost.hashtags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
            {previewPost.mediaType && (
              <p className="post-preview-media">
                Media: {previewPost.mediaType.replaceAll("_", " ")}
              </p>
            )}
            <PostMediaManager
              key={previewPost.id}
              postId={previewPost.id}
              previewMode={previewMode}
            />
            <div className="post-preview-links">
              {getSafeExternalUrl(previewPost.mediaUrl) && (
                <a
                  href={getSafeExternalUrl(previewPost.mediaUrl) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open submitted media <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              )}
              {getSafeExternalUrl(previewPost.postUrl) && (
                <a
                  href={getSafeExternalUrl(previewPost.postUrl) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original post <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              )}
              {!getSafeExternalUrl(previewPost.mediaUrl) &&
                !getSafeExternalUrl(previewPost.postUrl) && (
                  <span>No external preview is available for this record.</span>
                )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
