"use client";

import { useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import type { ApprovalStatus, SocialPost } from "@/types";
import PlatformBadge from "@/components/dashboard/PlatformBadge";

interface ModerationControlsProps {
  post: SocialPost;
  processing: boolean;
  previewMode: boolean;
  onReview: (id: string, status: ModerationDecision) => Promise<void>;
}

type ModerationDecision = "approved" | "rejected" | "removed";
type ReviewAction = ModerationDecision;

function actionLabel(action: ReviewAction): string {
  if (action === "approved") return "Approve";
  if (action === "rejected") return "Reject";
  return "Remove";
}

function postStatusLabel(status: ApprovalStatus): string {
  return status === "approved" ? "approved post" : `${status} post`;
}

export default function ModerationControls({
  post,
  processing,
  previewMode,
  onReview,
}: ModerationControlsProps) {
  const [confirmation, setConfirmation] = useState<ReviewAction | null>(null);

  function confirmReview() {
    if (!confirmation || previewMode) return;
    const status = confirmation;
    setConfirmation(null);
    void onReview(post.id, status);
  }

  const canRemove = post.approvalStatus !== "removed";

  return (
    <>
      <div className="moderation-control-stack">
        {(post.approvalStatus === "pending" || canRemove) && (
          <div className="action-group">
            {post.approvalStatus === "pending" && (
              <>
                <button
                  type="button"
                  className="action-button approve"
                  disabled={previewMode || processing}
                  onClick={() => setConfirmation("approved")}
                >
                  <Check size={13} aria-hidden="true" />
                  Approve
                </button>
                <button
                  type="button"
                  className="action-button reject"
                  disabled={previewMode || processing}
                  onClick={() => setConfirmation("rejected")}
                >
                  <X size={13} aria-hidden="true" />
                  Reject
                </button>
              </>
            )}
            {canRemove && (
              <button
                type="button"
                className="action-button remove"
                disabled={previewMode || processing}
                onClick={() => setConfirmation("removed")}
              >
                <Trash2 size={13} aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
        )}
        {previewMode && (
          <p className="preview-action-note">
            Actions are disabled in Developer Preview. No changes will be saved.
          </p>
        )}
      </div>

      {confirmation && !previewMode && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processing) {
              setConfirmation(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !processing) setConfirmation(null);
          }}
        >
          <section
            className="integration-dialog moderation-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="moderation-confirm-title"
            aria-describedby="moderation-confirm-description"
          >
            <span className={`moderation-confirm-icon ${confirmation}`}>
              {confirmation === "approved" ? <Check size={18} aria-hidden="true" /> :
                confirmation === "rejected" ? <X size={18} aria-hidden="true" /> :
                  <Trash2 size={18} aria-hidden="true" />}
            </span>
            <h2 id="moderation-confirm-title">
              {`${actionLabel(confirmation)} this post?`}
            </h2>
            <p id="moderation-confirm-description">
              {confirmation === "removed"
                ? `This removes the ${postStatusLabel(post.approvalStatus)} from the social wall without deleting its record.`
                : `Confirm the moderation decision for ${post.authorName}&apos;s post.`}
            </p>
            <div className="moderation-confirm-details">
              <PlatformBadge platform={post.platform} />
              <span>{post.caption || "No caption provided."}</span>
            </div>
            <div className="moderation-confirm-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={processing}
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`action-button ${confirmation}`}
                disabled={processing}
                onClick={confirmReview}
              >
                {`${actionLabel(confirmation)} post`}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
