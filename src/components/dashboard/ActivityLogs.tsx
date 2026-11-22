"use client";

import { useMemo, useState } from "react";
import { Activity, Clock3 } from "lucide-react";
import PanelHeading from "@/components/dashboard/PanelHeading";
import { formatDateTime } from "@/lib/format-date";
import type { ModerationActivity } from "@/types";

interface ActivityLogsProps {
  activities: ModerationActivity[];
  totalCount: number | null;
  loadError?: string;
  previewMode: boolean;
}

type ActionFilter = "all" | "approved" | "rejected" | "removed";

function formatAction(action: string): string {
  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ActivityLogs({
  activities,
  totalCount,
  loadError,
  previewMode,
}: ActivityLogsProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activities.filter((entry) => {
      const matchesAction =
        actionFilter === "all" || entry.action.toLowerCase() === actionFilter;
      const matchesSearch =
        !query ||
        [
          entry.action,
          entry.postId ?? "",
          entry.postPlatform ?? "",
          entry.postSummary ?? "",
          entry.adminUserId ?? "",
          entry.notes ?? "",
          entry.createdAt,
        ].some((value) => value.toLowerCase().includes(query));
      return matchesAction && matchesSearch;
    });
  }, [activities, actionFilter, search]);

  return (
    <section className="content-panel activity-logs-panel" aria-label="Moderation activity logs">
      <PanelHeading
        title="Activity logs"
        description="A record of moderation actions performed by administrators."
        action={
          <span className="submissions-total">
            {previewMode
              ? "Developer Preview"
              : totalCount === null
                ? "Total unavailable"
                : `${totalCount.toLocaleString()} entries`}
          </span>
        }
      />
      {previewMode ? (
        <p className="preview-inline-notice" role="status">
          No moderation logs or administrator details are loaded in Developer Preview.
        </p>
      ) : loadError ? (
        <p className="inline-error" role="alert">{loadError}</p>
      ) : null}
      <div className="activity-logs-toolbar">
        <label className="activity-logs-search" htmlFor="activity-log-search">
          <Activity size={14} aria-hidden="true" />
          <input
            id="activity-log-search"
            type="search"
            value={search}
            aria-label="Search action, post ID, or administrator"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, post ID, or administrator"
          />
        </label>
        <label className="activity-filter-field" htmlFor="activity-action-filter">
          <span>Action</span>
          <select
            id="activity-action-filter"
            value={actionFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "all" ||
                value === "approved" ||
                value === "rejected" ||
                value === "removed"
              ) {
                setActionFilter(value);
              }
            }}
          >
            <option value="all">All actions</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="removed">Removed</option>
          </select>
        </label>
        <span className="social-posts-result-count" aria-live="polite">
          {filteredActivities.length} shown
        </span>
      </div>
      <div className="table-scroll">
        <table className="submissions-table activity-logs-table">
          <thead>
            <tr>
              <th scope="col">Admin action</th>
              <th scope="col">Post reference</th>
              <th scope="col">Administrator</th>
              <th scope="col">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivities.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className="activity-log-action">
                    <Activity size={14} aria-hidden="true" />
                    {formatAction(entry.action)}
                  </span>
                  {entry.notes && <span className="activity-log-note">{entry.notes}</span>}
                </td>
                <td className="activity-post-reference">
                  {entry.postId ? (
                    <span className="activity-post-details">
                      {entry.postPlatform && (
                        <strong>{entry.postPlatform}</strong>
                      )}
                      {entry.postSummary && <span>{entry.postSummary}</span>}
                      <code title={entry.postId}>{entry.postId}</code>
                    </span>
                  ) : (
                    <span>Workspace event</span>
                  )}
                </td>
                <td>
                  {entry.adminUserId
                    ? `Admin · ${entry.adminUserId.slice(0, 8)}`
                    : "Administrator"}
                </td>
                <td className="date-cell">
                  <span className="activity-log-time">
                    <Clock3 size={13} aria-hidden="true" />
                    {formatDateTime(entry.createdAt)}
                  </span>
                </td>
              </tr>
            ))}
            {filteredActivities.length === 0 && (
              <tr>
                <td colSpan={4} className="social-posts-empty">
                  {previewMode
                    ? "No activity records are shown in this preview."
                    : loadError
                      ? "Activity records are unavailable."
                      : activities.length > 0
                        ? "No log entries match your search and action filter."
                        : "Moderation history will appear here after an action is recorded."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalCount !== null && totalCount > activities.length && (
        <div className="table-footnote">
          Showing the latest {activities.length} of {totalCount} activity records.
        </div>
      )}
      {previewMode && (
        <div className="activity-fields-placeholder" aria-label="Activity field placeholders">
          <strong>Log field placeholders — not activity records</strong>
          <div>
            <span>Action <b>—</b></span>
            <span>Post reference <b>—</b></span>
            <span>Administrator <b>Not signed in</b></span>
            <span>Timestamp <b>—</b></span>
          </div>
        </div>
      )}
    </section>
  );
}
