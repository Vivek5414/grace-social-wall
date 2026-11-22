import { CheckCircle2, Clock3, Layers3, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardCounts } from "@/types";

interface StatCardProps {
  label: string;
  value: number | string;
  context: string;
  icon: LucideIcon;
}

interface StatsCardsProps {
  counts: DashboardCounts;
  previewMode: boolean;
}

function StatCard({ label, value, context, icon: Icon }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-topline">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="stat-value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <p className="stat-context">{context}</p>
    </article>
  );
}

export default function StatsCards({ counts, previewMode }: StatsCardsProps) {
  return (
    <section className="stats-grid" aria-label="Database-backed statistics">
      <StatCard
        label="Total Posts"
        value={counts.total ?? "—"}
        context={previewMode ? "Not loaded in Developer Preview" : counts.total === null ? "Unavailable" : "Recorded in the database"}
        icon={Layers3}
      />
      <StatCard
        label="Pending Approval"
        value={counts.pending ?? "—"}
        context={previewMode ? "Not loaded in Developer Preview" : counts.pending === null ? "Unavailable" : "Awaiting review"}
        icon={Clock3}
      />
      <StatCard
        label="Approved Posts"
        value={counts.approved ?? "—"}
        context={previewMode ? "Not loaded in Developer Preview" : counts.approved === null ? "Unavailable" : "Approved for the social wall"}
        icon={CheckCircle2}
      />
      <StatCard
        label="Rejected Posts"
        value={counts.rejected ?? "—"}
        context={previewMode ? "Not loaded in Developer Preview" : counts.rejected === null ? "Unavailable" : "Rejected during moderation"}
        icon={XCircle}
      />
    </section>
  );
}
