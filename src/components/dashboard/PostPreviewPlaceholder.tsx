import { Camera, Check, X } from "lucide-react";

interface PostPreviewPlaceholderProps {
  showModerationActions?: boolean;
}

export default function PostPreviewPlaceholder({
  showModerationActions = false,
}: PostPreviewPlaceholderProps) {
  return (
    <article className="post-preview-placeholder">
      <div className="post-media-placeholder" aria-label="Post media preview placeholder">
        <Camera size={22} strokeWidth={1.6} aria-hidden="true" />
        <span>Media preview</span>
      </div>
      <span className="preview-placeholder-label">Post preview placeholder</span>
      <p>No real social posts are loaded in Developer Preview.</p>
      {showModerationActions && (
        <>
          <div className="action-group preview-placeholder-actions">
            <button type="button" className="action-button approve" disabled>
              <Check size={13} aria-hidden="true" />
              Approve
            </button>
            <button type="button" className="action-button reject" disabled>
              <X size={13} aria-hidden="true" />
              Reject
            </button>
          </div>
          <p className="preview-action-note">
            Actions are disabled in Developer Preview. No changes will be saved.
          </p>
        </>
      )}
    </article>
  );
}
