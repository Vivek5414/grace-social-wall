import { Clock3, Info } from "lucide-react";
import PanelHeading from "@/components/dashboard/PanelHeading";

export default function SyncLogsPanel() {
  return (
    <section className="content-panel" aria-label="Sync logs">
      <PanelHeading
        title="Sync logs"
        description="Review the status and history of platform data synchronization."
      />
      <div className="sync-unavailable">
        <span className="empty-icon"><Clock3 size={20} aria-hidden="true" /></span>
        <h3>Sync history is not available</h3>
        <p>
          The current database schema does not include a sync-log table, and no social platform
          integrations are configured.
        </p>
        <div className="integration-notice">
          <Info size={15} aria-hidden="true" />
          Sync records will appear here after a sync service and persistent log storage are added.
        </div>
      </div>
    </section>
  );
}
