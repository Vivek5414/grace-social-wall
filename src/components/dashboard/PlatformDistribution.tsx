import { Camera, UsersRound, AtSign, BriefcaseBusiness } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SocialPlatform } from "@/types";
import type { DashboardData } from "@/types";
import PanelHeading from "@/components/dashboard/PanelHeading";

const platforms: Array<{ id: SocialPlatform; label: string; icon: LucideIcon }> = [
  { id: "instagram", label: "Instagram", icon: Camera },
  { id: "facebook", label: "Facebook", icon: UsersRound },
  { id: "x", label: "X", icon: AtSign },
  { id: "linkedin", label: "LinkedIn", icon: BriefcaseBusiness },
];

interface PlatformDistributionProps {
  counts: DashboardData["platformCounts"];
  loadError?: string;
  previewMode: boolean;
}

export default function PlatformDistribution({
  counts,
  loadError,
  previewMode,
}: PlatformDistributionProps) {
  const total = platforms.reduce((sum, { id }) => sum + (counts[id] ?? 0), 0);

  return (
    <section className="content-panel distribution-panel" aria-label="Platform distribution">
      <PanelHeading
        title="Platform distribution"
        description={previewMode ? "Statistics are not loaded in Developer Preview" : "All posts recorded in the database"}
      />
      {previewMode ? (
        <p className="empty-state">No protected platform statistics were queried in this preview.</p>
      ) : loadError ? (
        <p className="inline-error" role="alert">{loadError}</p>
      ) : total > 0 ? (
        <div className="distribution-list">
          {platforms.map(({ id, label, icon: Icon }) => {
            const count = counts[id] ?? 0;
            const percentage = Math.round((count / total) * 100);
            return (
              <div className="distribution-row" key={id}>
                <div className="distribution-label">
                  <span className={`platform-icon ${id}`}>
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
                <div
                  className="distribution-track"
                  role="img"
                  aria-label={`${label}: ${count} posts, ${percentage}% of all posts`}
                >
                  <span style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">Platform statistics will appear when posts are available.</p>
      )}
    </section>
  );
}
