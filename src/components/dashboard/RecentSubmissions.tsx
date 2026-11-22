"use client";

import { ArrowUpRight, ListChecks } from "lucide-react";
import type { ApprovalStatus, SocialPost } from "@/types";
import PlatformBadge from "@/components/dashboard/PlatformBadge";
import ModerationControls from "@/components/dashboard/ModerationControls";
import PanelHeading from "@/components/dashboard/PanelHeading";
import PostPreviewPlaceholder from "@/components/dashboard/PostPreviewPlaceholder";
import { formatDateTime } from "@/lib/format-date";
import { getSafeExternalUrl } from "@/lib/external-url";

interface RecentSubmissionsProps {
  posts: SocialPost[];
  onReview?: (id: string, status: "approved" | "rejected" | "removed") => Promise<void>;
  processingId?: string | null;
  title?: string;
  description?: string;
  emptyMessage?: string;
  loadedCount?: number;
  totalCount?: number | null;
  previewMode?: boolean;
}

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Published",
  rejected: "Rejected",
  removed: "Removed",
};

function StatusBadge({ status }: { status: ApprovalStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}

export default function RecentSubmissions({
  posts,
  onReview,
  processingId,
  title = "Recent submissions",
  description = "Latest posts received from the configured social platforms.",
  emptyMessage = "No posts are available yet.",
  loadedCount,
  totalCount,
  previewMode = false,
}: RecentSubmissionsProps) {
  return (
    <section className="content-panel" aria-label={title}>
      <PanelHeading
        title={title}
        description={description}
        action={
          <>
            <span className="submissions-total">{posts.length} shown</span>
            <ListChecks size={17} aria-hidden="true" />
          </>
        }
      />
      {posts.length > 0 ? (
        <div className="table-scroll">
          <table className="submissions-table">
            <thead>
              <tr>
                <th scope="col">Post</th>
                <th scope="col">Platform</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <div className="post-cell">
                      <span className="post-avatar" aria-hidden="true">
                        {post.authorName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="post-copy">
                        <strong>{post.authorName}</strong>
                        <span>
                          {post.authorUsername ? `${post.authorUsername} · ` : ""}
                          {post.caption || "No caption"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td><PlatformBadge platform={post.platform} /></td>
                  <td><StatusBadge status={post.approvalStatus} /></td>
                  <td className="date-cell">{formatDateTime(post.createdAt)}</td>
                  <td>
                    {onReview && post.approvalStatus === "pending" ? (
                      <ModerationControls
                        post={post}
                        processing={processingId !== null}
                        previewMode={previewMode}
                        onReview={onReview}
                      />
                    ) : getSafeExternalUrl(post.postUrl) ? (
                      <a
                        className="post-link"
                        href={getSafeExternalUrl(post.postUrl) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open original post from ${post.authorName}`}
                      >
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="action-complete">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        previewMode ? (
          <div className="preview-empty-layout">
            <p className="empty-state">{emptyMessage}</p>
            <PostPreviewPlaceholder />
          </div>
        ) : (
          <p className="empty-state">{emptyMessage}</p>
        )
      )}
      <div className="table-footnote">
        {totalCount !== null && totalCount !== undefined && loadedCount !== undefined && totalCount > loadedCount
          ? `Showing the latest ${loadedCount} of ${totalCount} posts. `
          : ""}
        {previewMode
          ? "No database records are loaded in Developer Preview."
          : "Posts and statuses are loaded from the Grace Social Wall database."}
      </div>
    </section>
  );
}
