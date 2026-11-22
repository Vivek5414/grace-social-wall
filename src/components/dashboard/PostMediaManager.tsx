"use client";

import { useEffect, useState } from "react";
import { FileImage, FileVideo, LoaderCircle, Upload } from "lucide-react";
import { listPostMediaAction } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import type { PostMediaAttachment } from "@/types";

const BUCKET = "grace-social-wall-media";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

interface PostMediaManagerProps {
  postId: string;
  previewMode: boolean;
}

export default function PostMediaManager({
  postId,
  previewMode,
}: PostMediaManagerProps) {
  const [attachments, setAttachments] = useState<PostMediaAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(!previewMode);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (previewMode) return;
    let active = true;

    void listPostMediaAction(postId)
      .then((result) => {
        if (!active) return;
        if (result.success) {
          setAttachments(result.data);
          setError(null);
        } else {
          setError(result.message);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        console.error("[admin dashboard] Could not load post media:", requestError);
        setError("Private media could not be loaded.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [postId, previewMode]);

  async function uploadFile(file: File) {
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, WebP, MP4, or QuickTime file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Files must be 25 MB or smaller.");
      return;
    }

    setError(null);
    setIsUploading(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^\w.-]/g, "_").slice(-100) || "media";
    const path = `${postId}/${crypto.randomUUID()}-${safeName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "300",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const result = await listPostMediaAction(postId);
      if (!result.success) {
        const { error: cleanupError } = await supabase.storage
          .from(BUCKET)
          .remove([path]);
        if (cleanupError) {
          console.error("[admin dashboard] Failed to clean up uploaded media:", cleanupError);
        }
        throw new Error(result.message);
      }

      setAttachments(result.data);
    } catch (uploadError) {
      console.error("[admin dashboard] Media upload failed:", uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The media upload could not be completed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="post-media-manager" aria-label="Private post media" aria-busy={isLoading || isUploading}>
      <div className="post-media-manager-heading">
        <div>
          <strong>Private media</strong>
          <span>Only allowlisted administrators can open these files.</span>
        </div>
        {!previewMode && (
          <label className="secondary-button post-media-upload">
            {isUploading ? (
              <LoaderCircle className="post-media-spinner" size={14} aria-hidden="true" />
            ) : (
              <Upload size={14} aria-hidden="true" />
            )}
            {isUploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              disabled={isLoading || isUploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void uploadFile(file);
              }}
            />
          </label>
        )}
      </div>

      {previewMode ? (
        <p className="post-media-message">Media uploads are disabled in Developer Preview.</p>
      ) : isLoading ? (
        <p className="post-media-message">Loading protected media…</p>
      ) : error ? (
        <p className="post-media-error" role="alert">{error}</p>
      ) : attachments.length > 0 ? (
        <ul className="post-media-list">
          {attachments.map((attachment) => {
            const isVideo = /\.(mp4|mov)$/i.test(attachment.name);
            const Icon = isVideo ? FileVideo : FileImage;
            return (
              <li key={attachment.name}>
                <Icon size={15} aria-hidden="true" />
                <a href={attachment.url} target="_blank" rel="noreferrer">
                  {attachment.name.replace(/^[0-9a-f-]{36}-/i, "")}
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="post-media-message">No private media has been uploaded for this post.</p>
      )}

      {!previewMode && (
        <p className="post-media-footnote">Maximum 25 MB per image or video. Access links expire after five minutes.</p>
      )}
    </section>
  );
}
