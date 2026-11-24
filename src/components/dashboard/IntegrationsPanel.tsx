"use client";

import { useState } from "react";
import {
  AtSign,
  BriefcaseBusiness,
  Camera,
  CircleHelp,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SocialPlatform } from "@/types";
import PanelHeading from "@/components/dashboard/PanelHeading";

interface Integration {
  id: SocialPlatform;
  name: string;
  description: string;
  icon: LucideIcon;
}

const integrations: Integration[] = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Collect and moderate posts from Instagram.",
    icon: Camera,
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Collect and moderate posts from Facebook.",
    icon: UsersRound,
  },
  {
    id: "x",
    name: "X",
    description: "Collect and moderate public posts from X.",
    icon: AtSign,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Collect and moderate posts from LinkedIn.",
    icon: BriefcaseBusiness,
  },
];

export default function IntegrationsPanel() {
  const [selected, setSelected] = useState<Integration | null>(null);

  return (
    <>
      <section className="content-panel" aria-label="Social integrations">
        <PanelHeading
          title="Social integrations"
          description="Manage the platforms that can contribute posts to your wall."
        />
        <div className="integration-grid">
          {integrations.map(({ id, name, description, icon: Icon }) => (
            <article className="integration-card" key={id}>
              <div className={`integration-icon ${id}`}>
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="integration-card-title">
                <h3>{name}</h3>
                <span className="connection-status">
                  <span aria-hidden="true" />
                  Not connected
                </span>
              </div>
              <p>{description}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelected(integrations.find((item) => item.id === id) ?? null)}
              >
                Configure
              </button>
            </article>
          ))}
        </div>
        <div className="integration-notice">
          <CircleHelp size={16} aria-hidden="true" />
          <p>
            OAuth connections are not configured. Platform integrations remain disconnected.
          </p>
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          {(() => {
            const SelectedIcon = selected.icon;
            return (
              <section
                className="integration-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="integration-dialog-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="icon-button dialog-close"
                  aria-label="Close configuration details"
                  onClick={() => setSelected(null)}
                >
                  <X size={18} aria-hidden="true" />
                </button>
                <span className={`integration-icon ${selected.id}`}>
                  <SelectedIcon size={21} aria-hidden="true" />
                </span>
                <h2 id="integration-dialog-title">Configure {selected.name}</h2>
                <p>
                  OAuth and platform credential setup has not been implemented. No credentials
                  have been saved, and {selected.name} remains disconnected.
                </p>
                <button type="button" className="primary-button" onClick={() => setSelected(null)}>
                  Close
                </button>
              </section>
            );
          })()}
        </div>
      )}
    </>
  );
}
