import { AtSign, BriefcaseBusiness, Camera, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SocialPlatform } from "@/types";

const platformDetails: Record<SocialPlatform, { label: string; icon: LucideIcon }> = {
  instagram: { label: "Instagram", icon: Camera },
  facebook: { label: "Facebook", icon: UsersRound },
  x: { label: "X", icon: AtSign },
  linkedin: { label: "LinkedIn", icon: BriefcaseBusiness },
};

export default function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const { label, icon: Icon } = platformDetails[platform];

  return (
    <span className="platform-cell">
      <span className={`platform-icon ${platform}`}>
        <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
      </span>
      {label}
    </span>
  );
}
