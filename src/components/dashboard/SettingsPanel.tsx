import {
  Building2,
  Camera,
  LockKeyhole,
  UsersRound,
  AtSign,
  BriefcaseBusiness,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PanelHeading from "@/components/dashboard/PanelHeading";
import type { AdminProfile } from "@/types";

interface SettingsPanelProps {
  profile: AdminProfile | null;
  previewMode: boolean;
}

const socialPlatforms: Array<{ name: string; icon: LucideIcon }> = [
  { name: "Instagram", icon: Camera },
  { name: "Facebook", icon: UsersRound },
  { name: "X", icon: AtSign },
  { name: "LinkedIn", icon: BriefcaseBusiness },
];

export default function SettingsPanel({
  profile,
  previewMode,
}: SettingsPanelProps) {
  return (
    <div className="settings-page">
      <section className="content-panel" aria-label="Workspace settings">
        <PanelHeading
          title="Workspace settings"
          description="Workspace configuration and administrator access."
        />
        <div className="settings-profile-card">
          <span className="settings-profile-avatar">
            {previewMode
              ? "DV"
              : profile?.email?.slice(0, 2).toUpperCase() ?? "AD"}
          </span>
          <div>
            <strong>{previewMode ? "Developer Preview" : "Administrator"}</strong>
            <span>
              {profile?.email ??
                (previewMode
                  ? "No account loaded; preview only"
                  : "Email unavailable")}
            </span>
          </div>
          <span className={`settings-profile-status ${previewMode ? "preview" : ""}`}>
            {previewMode ? "Local only" : "Signed in"}
          </span>
        </div>
        <div className="settings-list">
          <article className="settings-row">
            <span className="settings-icon"><Building2 size={18} aria-hidden="true" /></span>
            <div>
              <h3>Workspace</h3>
              <p>Grace Technologies · Grace Social Wall</p>
            </div>
            <span className="settings-note">Application identity</span>
          </article>
          <article className="settings-row">
            <span className="settings-icon"><LockKeyhole size={18} aria-hidden="true" /></span>
            <div>
              <h3>Administrator access</h3>
              <p>
                {previewMode
                  ? "The local UI bypasses page login only. Server actions and database access still require an allowlisted administrator."
                  : "Access is verified on the server against the Supabase administrator allowlist."}
              </p>
            </div>
            <span className="settings-note">
              {previewMode ? "Bypass active" : "Verified"}
            </span>
          </article>
        </div>
      </section>

      <section className="content-panel settings-preferences-panel" aria-label="Application preferences">
        <PanelHeading
          title="Application preferences"
          description="Preference controls are visual placeholders and are not saved."
          action={<span className="settings-preview-label">Preview only</span>}
        />
        <div className="settings-preference-grid">
          <label>
            <span>Default moderation</span>
            <select disabled defaultValue="">
              <option value="">Not configured</option>
            </select>
          </label>
          <label>
            <span>Notification preference</span>
            <span className="settings-checkbox-placeholder">
              <input type="checkbox" disabled />
              Email notifications
            </span>
          </label>
          <p>Application preference storage is not configured.</p>
        </div>
      </section>

      <section className="content-panel settings-integrations-panel" aria-label="Social platform connection status">
        <PanelHeading
          title="Social platforms"
          description="Connection status is shown without storing credentials here."
        />
        <div className="settings-platform-list">
          {socialPlatforms.map(({ name, icon: Icon }) => (
            <div className="settings-platform-row" key={name}>
              <span className="settings-platform-icon"><Icon size={15} aria-hidden="true" /></span>
              <span>{name}</span>
              <span className="settings-platform-status">
                <span aria-hidden="true" />
                Not connected
              </span>
            </div>
          ))}
        </div>
        {previewMode && (
          <p className="preview-inline-notice" role="status">
            Social connections are not configured in this preview.
          </p>
        )}
      </section>
    </div>
  );
}
