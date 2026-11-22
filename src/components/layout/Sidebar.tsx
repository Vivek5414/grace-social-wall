"use client";

import Image from "next/image";
import {
  Check,
  Activity,
  CircleHelp,
  Clock3,
  FileText,
  Hash,
  LayoutDashboard,
  Link2,
  ListChecks,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardSection } from "@/types";
import LogoutButton from "@/components/layout/LogoutButton";

interface SidebarProps {
  activeSection: DashboardSection;
  pendingCount: number;
  isOpen: boolean;
  onSectionChange: (section: DashboardSection) => void;
  onClose: () => void;
  adminEmail: string | null;
  developmentBypass: boolean;
}

interface NavigationItem {
  label: DashboardSection;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Social Posts", icon: FileText },
  { label: "Moderation Queue", icon: ListChecks },
  { label: "Published Posts", icon: Check },
  { label: "Hashtag Manager", icon: Hash },
  { label: "Activity Logs", icon: Activity },
  { label: "Social Integrations", icon: Link2 },
  { label: "Sync Logs", icon: Clock3 },
  { label: "Settings", icon: Settings },
];

export default function Sidebar({
  activeSection,
  pendingCount,
  isOpen,
  onSectionChange,
  onClose,
  adminEmail,
  developmentBypass,
}: SidebarProps) {
  const avatar = adminEmail
    ? adminEmail.slice(0, 2).toUpperCase()
    : developmentBypass ? "DV" : "AD";

  return (
    <>
      <button
        type="button"
        className={`mobile-scrim ${isOpen ? "visible" : ""}`}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <Image
            className="brand-logo"
            src="/grace-technologies-logo.png"
            alt="Grace Technologies"
            width={42}
            height={42}
          />
          <span className="brand-copy">
            <span className="brand-name">Grace Social Wall</span>
            <span className="brand-caption">By Grace Technologies</span>
          </span>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-avatar">GT</span>
          <span className="workspace-info">
            <strong>Grace Technologies</strong>
            <span>Grace Social Wall</span>
          </span>
        </div>

        <p className="nav-label">Workspace</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigationItems.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              className={`nav-link ${activeSection === label ? "active" : ""}`}
              aria-current={activeSection === label ? "page" : undefined}
              onClick={() => {
                onSectionChange(label);
                onClose();
              }}
            >
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {label === "Moderation Queue" && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <CircleHelp size={17} aria-hidden="true" />
            <span>
              <strong>Need a hand?</strong>
              Visit our help center
            </span>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">{avatar}</span>
            <span className="profile-copy">
              <strong>{developmentBypass ? "Developer preview" : "Administrator"}</strong>
              <span>
                {developmentBypass
                  ? "Local development bypass"
                  : adminEmail ?? "Allowlist verified"}
              </span>
            </span>
            {!developmentBypass && <LogoutButton />}
          </div>
        </div>
      </aside>
    </>
  );
}
