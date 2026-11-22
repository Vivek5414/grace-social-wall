import { Activity, Check, Clock3, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PanelHeading from "@/components/dashboard/PanelHeading";
import { formatDateTime } from "@/lib/format-date";
import type { ModerationActivity } from "@/types";

interface RecentActivityProps {
  activities: ModerationActivity[];
  loadError?: string;
  previewMode: boolean;
}

function activityCopy(action: string): { label: string; icon: LucideIcon } {
  if (action === "approved") return { label: "Post approved", icon: Check };
  if (action === "rejected") return { label: "Post rejected", icon: X };
  if (action === "removed") return { label: "Post removed", icon: X };
  return { label: action.replaceAll("_", " "), icon: Activity };
}

export default function RecentActivity({
  activities,
  loadError,
  previewMode,
}: RecentActivityProps) {
  return (
    <section className="content-panel activity-panel" aria-label="Recent moderation activity">
      <PanelHeading
        title="Recent activity"
        description="Latest entries from the moderation log."
      />
      {previewMode ? (
        <p className="empty-state">No protected activity records were queried in this preview.</p>
      ) : loadError ? (
        <p className="inline-error">{loadError}</p>
      ) : activities.length > 0 ? (
        <ol className="activity-list">
          {activities.slice(0, 8).map((entry) => {
            const { label, icon: Icon } = activityCopy(entry.action);
            return (
              <li className="activity-item" key={entry.id}>
                <span className="activity-icon"><Icon size={14} aria-hidden="true" /></span>
                <div className="activity-copy">
                  <strong>{label}</strong>
                  <span>
                    {entry.notes ||
                      entry.postSummary ||
                      (entry.postId ? "Post moderation recorded" : "Workspace activity")}
                  </span>
                  <time dateTime={entry.createdAt}>
                    <Clock3 size={12} aria-hidden="true" />
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="empty-state">Moderation activity will appear here when actions are recorded.</p>
      )}
    </section>
  );
}
