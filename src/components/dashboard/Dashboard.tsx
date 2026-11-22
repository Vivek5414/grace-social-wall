"use client";

import { useMemo, useState } from "react";
import { Code2, Database, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import HashtagManager from "@/components/dashboard/HashtagManager";
import IntegrationsPanel from "@/components/dashboard/IntegrationsPanel";
import ModerationQueue from "@/components/dashboard/ModerationQueue";
import ActivityLogs from "@/components/dashboard/ActivityLogs";
import PlatformDistribution from "@/components/dashboard/PlatformDistribution";
import RecentActivity from "@/components/dashboard/RecentActivity";
import RecentSubmissions from "@/components/dashboard/RecentSubmissions";
import SocialPosts from "@/components/dashboard/SocialPosts";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import StatsCards from "@/components/dashboard/StatsCards";
import SyncLogsPanel from "@/components/dashboard/SyncLogsPanel";
import { reviewPostAction } from "@/app/admin/actions";
import type {
  ApprovalStatus,
  DashboardCounts,
  DashboardData,
  DashboardSection,
  SocialPost,
} from "@/types";

interface DashboardProps {
  initialData: DashboardData;
}

const sectionDescriptions: Record<DashboardSection, string> = {
  Overview: "A clear view of posts and moderation activity in your workspace.",
  "Social Posts": "Search, filter, preview, and moderate posts in your workspace.",
  "Moderation Queue": "Review incoming posts before they appear on your social wall.",
  "Published Posts": "Browse posts approved for your social wall.",
  "Hashtag Manager": "Organize the hashtags used to collect community posts.",
  "Activity Logs": "Review the moderation actions recorded by administrators.",
  "Social Integrations": "View platform connection status and setup availability.",
  "Sync Logs": "Review synchronization history when a sync service is configured.",
  Settings: "Review workspace and administrator access settings.",
};

function matchesSearch(post: SocialPost, query: string): boolean {
  return [
    post.authorName,
    post.authorUsername,
    post.caption,
    post.platform,
    ...post.hashtags,
  ].some((value) => value.toLowerCase().includes(query));
}

type CountedStatus = "pending" | "approved" | "rejected";

function countedStatus(status: ApprovalStatus): CountedStatus | null {
  return status === "pending" || status === "approved" || status === "rejected"
    ? status
    : null;
}

export default function Dashboard({ initialData }: DashboardProps) {
  const [posts, setPosts] = useState(initialData.posts);
  const [pendingPosts, setPendingPosts] = useState(initialData.pendingPosts);
  const [publishedPosts, setPublishedPosts] = useState(initialData.publishedPosts);
  const [counts, setCounts] = useState(initialData.counts);
  const [activities, setActivities] = useState(initialData.activities);
  const [activityCount, setActivityCount] = useState(initialData.activityCount);
  const [activeSection, setActiveSection] = useState<DashboardSection>("Overview");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);

  const previewMode = initialData.developmentBypass;
  const pendingCount = counts.pending;
  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => !query || matchesSearch(post, query));
  }, [posts, search]);
  const filteredPendingPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pendingPosts.filter((post) => !query || matchesSearch(post, query));
  }, [pendingPosts, search]);
  const filteredPublishedPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return publishedPosts.filter((post) => !query || matchesSearch(post, query));
  }, [publishedPosts, search]);

  async function reviewPost(
    id: string,
    status: "approved" | "rejected" | "removed",
  ) {
    if (previewMode) {
      setFeedback({
        message: "Moderation is disabled in Developer Preview. No changes were made.",
        error: true,
      });
      return;
    }

    const previousPost = posts.find((post) => post.id === id);
    const previousStatus = previousPost?.approvalStatus ?? "pending";
    setProcessingId(id);
    setFeedback(null);

    try {
      const result = await reviewPostAction(id, status);
      if (!result.success) {
        setFeedback({ message: result.message, error: true });
        return;
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === id
            ? {
                ...post,
                approvalStatus: result.data.approvalStatus,
                approvedAt: result.data.approvedAt,
              }
            : post,
        ),
      );
      const reviewedPost = previousPost ?? pendingPosts.find((post) => post.id === id);
      setPendingPosts((current) => current.filter((post) => post.id !== id));
      setPublishedPosts((current) =>
        status === "approved" && reviewedPost
          ? [
              {
                ...reviewedPost,
                approvalStatus: result.data.approvalStatus,
                approvedAt: result.data.approvedAt,
              },
              ...current.filter((post) => post.id !== id),
            ].slice(0, 100)
          : current.filter((post) => post.id !== id),
      );
      setCounts((current) => {
        const next: DashboardCounts = { ...current };
        const oldCount = countedStatus(previousStatus);
        const newCount = countedStatus(result.data.approvalStatus);

        if (oldCount && oldCount !== newCount && next[oldCount] !== null) {
          next[oldCount] = Math.max(0, next[oldCount] - 1);
        }
        if (newCount && oldCount !== newCount && next[newCount] !== null) {
          next[newCount] += 1;
        }
        return next;
      });
      setFeedback({
        message: result.warning
          ? `${result.message} ${result.warning}`
          : result.message,
        error: Boolean(result.warning),
      });

      const newActivity = result.data.activity;
      if (newActivity) {
        setActivities((current) => [newActivity, ...current].slice(0, 100));
        setActivityCount((current) => current === null ? null : current + 1);
      }
    } catch (error) {
      console.error("[admin dashboard] Moderation request failed:", error);
      setFeedback({ message: "The moderation request could not be completed. Try again.", error: true });
    } finally {
      setProcessingId(null);
    }
  }

  const welcomeHeading =
    activeSection === "Overview" ? "Welcome to your workspace" : activeSection;

  return (
    <div className="dashboard-shell">
      <Sidebar
        activeSection={activeSection}
        pendingCount={pendingCount ?? 0}
        adminEmail={initialData.adminProfile?.email ?? null}
        developmentBypass={initialData.developmentBypass}
        isOpen={sidebarOpen}
        onSectionChange={setActiveSection}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-area">
        <Header
          activeSection={activeSection}
          search={search}
          onSearchChange={setSearch}
          onOpenMenu={() => setSidebarOpen(true)}
        />

        <div className="content">
          {previewMode && (
            <div className="developer-preview-banner" role="status">
              <Code2 size={16} aria-hidden="true" />
              <strong>Developer Preview</strong>
              <span>
                No protected Supabase records are queried. Mutations require an allowlisted admin session.
              </span>
            </div>
          )}
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span>Grace Social Wall</span>
                <span aria-hidden="true">·</span>
                <span>{activeSection}</span>
              </div>
              <h1>{welcomeHeading}</h1>
              <p>{sectionDescriptions[activeSection]}</p>
            </div>
            <span className="data-source-label">
              {previewMode ? <Code2 size={14} aria-hidden="true" /> : <Database size={14} aria-hidden="true" />}
              {previewMode ? "Local UI preview · no live data" : "Supabase workspace data"}
            </span>
          </section>

          {feedback && (
            <p className={feedback.error ? "notice-banner error" : "notice-banner success"} role="status">
              {feedback.message}
            </p>
          )}

          {activeSection === "Overview" && (
            <>
              <StatsCards counts={counts} previewMode={previewMode} />
              {!previewMode && initialData.errors.posts && (
                <p className="notice-banner error" role="alert">{initialData.errors.posts}</p>
              )}
              {!previewMode && initialData.errors.counts && (
                <p className="notice-banner warning" role="status">{initialData.errors.counts}</p>
              )}
              <div className="dashboard-lower-grid">
                <RecentSubmissions
                  posts={filteredPosts.slice(0, 6)}
                  onReview={reviewPost}
                  processingId={processingId}
                  title="Recent submissions"
                  description="The latest posts recorded in your workspace."
                  previewMode={previewMode}
                  emptyMessage={
                    previewMode
                      ? "No social posts are shown in Developer Preview."
                      : initialData.errors.posts
                      ? "Post records are unavailable."
                      : search.trim()
                        ? "No posts match your search."
                        : "No posts have been submitted yet."
                  }
                />
                <PlatformDistribution
                  counts={initialData.platformCounts}
                  loadError={initialData.errors.platformCounts}
                  previewMode={previewMode}
                />
              </div>
              <RecentActivity
                activities={activities}
                loadError={initialData.errors.activities}
                previewMode={previewMode}
              />
            </>
          )}

          {activeSection === "Social Posts" && (
            <SocialPosts
              posts={filteredPosts}
              totalCount={counts.total}
              search={search}
              loadError={initialData.errors.posts}
              previewMode={previewMode}
              processingId={processingId}
              onSearchChange={setSearch}
              onReview={reviewPost}
            />
          )}

          {activeSection === "Moderation Queue" && (
            <>
              {!previewMode && initialData.errors.posts && (
                <p className="notice-banner error" role="alert">{initialData.errors.posts}</p>
              )}
              {!previewMode && initialData.errors.queue && (
                <p className="notice-banner error" role="alert">{initialData.errors.queue}</p>
              )}
              {!previewMode && initialData.errors.postHashtags && (
                <p className="notice-banner warning" role="status">{initialData.errors.postHashtags}</p>
              )}
              <ModerationQueue
                posts={filteredPendingPosts}
                loadedCount={pendingPosts.length}
                totalCount={counts.pending}
                processingId={processingId}
                onReview={reviewPost}
                previewMode={previewMode}
                emptyMessage={
                  previewMode
                    ? "The queue is not loaded so this preview contains no real post records."
                    : initialData.errors.queue
                    ? "The queue is unavailable."
                    : pendingPosts.length > 0 && search.trim()
                      ? "No pending posts match your search."
                      : "There are no posts waiting for review."
                }
              />
            </>
          )}

          {activeSection === "Published Posts" && (
            <>
              {!previewMode && initialData.errors.published && (
                <p className="notice-banner error" role="alert">{initialData.errors.published}</p>
              )}
              <RecentSubmissions
                posts={filteredPublishedPosts}
                title="Published posts"
                description="Latest posts approved for display on your social wall."
                previewMode={previewMode}
                emptyMessage={
                  previewMode
                    ? "No approved posts are shown in Developer Preview."
                    : initialData.errors.published
                    ? "Published post records are unavailable."
                    : publishedPosts.length > 0 && search.trim()
                      ? "No published posts match your search."
                      : "No approved posts are available yet."
                }
                loadedCount={publishedPosts.length}
                totalCount={counts.approved}
              />
            </>
          )}

          {activeSection === "Hashtag Manager" && (
            <HashtagManager
              initialHashtags={initialData.hashtags}
              loadError={initialData.errors.hashtags}
              previewMode={previewMode}
            />
          )}

          {activeSection === "Activity Logs" && (
            <ActivityLogs
              activities={activities}
              totalCount={activityCount}
              loadError={initialData.errors.activities}
              previewMode={previewMode}
            />
          )}

          {activeSection === "Social Integrations" && <IntegrationsPanel />}
          {activeSection === "Sync Logs" && <SyncLogsPanel />}
          {activeSection === "Settings" && (
            <SettingsPanel
              profile={initialData.adminProfile}
              previewMode={previewMode}
            />
          )}

          <p className="data-footnote">
            <Sparkles size={13} aria-hidden="true" />
            {previewMode
              ? "Preview mode contains no real statistics, social posts, or activity records."
              : "Dashboard values reflect database records. Platform connections and sync history are not configured."}
          </p>
        </div>
      </main>
    </div>
  );
}
