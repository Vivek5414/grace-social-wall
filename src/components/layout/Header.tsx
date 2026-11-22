"use client";

import { Bell, Menu, Search } from "lucide-react";
import type { DashboardSection } from "@/types";

interface HeaderProps {
  activeSection: DashboardSection;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenMenu: () => void;
}

export default function Header({
  activeSection,
  search,
  onSearchChange,
  onOpenMenu,
}: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button
          type="button"
          className="icon-button mobile-menu-button"
          aria-label="Open navigation"
          onClick={onOpenMenu}
        >
          <Menu size={19} aria-hidden="true" />
        </button>
        <div className="breadcrumbs">
          <span>Grace Technologies</span>
          <span aria-hidden="true">/</span>
          <strong>{activeSection}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <label className="search-box">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search posts and hashtags..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search posts and hashtags"
          />
        </label>
        <button type="button" className="icon-button" aria-label="Notifications">
          <Bell size={17} aria-hidden="true" />
          <span className="notification-dot" />
        </button>
      </div>
    </header>
  );
}
