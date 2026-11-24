"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import type {
  InstagramDiscoveredMedia,
  InstagramMediaAsset,
  InstagramMediaSource,
} from "@/lib/instagram/types";

function InstagramAssetPreview({
  asset,
  label,
}: {
  asset: InstagramMediaAsset;
  label: string;
}) {
  const [unavailable, setUnavailable] = useState(false);
  const previewUrl = asset.mediaUrl ?? asset.previewUrl;

  if (!previewUrl || unavailable) {
    return (
      <div className="instagram-media-fallback" role="status">
        Preview unavailable. Instagram may omit the media URL or it may have expired.
      </div>
    );
  }

  if (
    (asset.mediaType === "VIDEO" || asset.mediaType === "REELS") &&
    asset.mediaUrl
  ) {
    return (
      <video
        className="instagram-media-video"
        controls
        playsInline
        preload="metadata"
        poster={asset.previewUrl ?? undefined}
        onError={() => setUnavailable(true)}
      >
        <source src={asset.mediaUrl} />
        Video preview unavailable.
      </video>
    );
  }

  return (
    <Image
      className="instagram-media-image"
      src={previewUrl}
      alt={
        !asset.mediaUrl &&
        (asset.mediaType === "VIDEO" || asset.mediaType === "REELS")
          ? `${label} preview`
          : label
      }
      width={640}
      height={640}
      unoptimized
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setUnavailable(true)}
    />
  );
}

function mediaAssets(post: InstagramDiscoveredMedia): InstagramMediaAsset[] {
  if (post.mediaType !== "CAROUSEL_ALBUM") {
    return [{
      id: post.id,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      previewUrl: post.previewUrl,
    }];
  }
  return post.children.length > 0
    ? post.children
    : [{
        id: post.id,
        mediaType: post.mediaType,
        mediaUrl: post.mediaUrl,
        previewUrl: post.previewUrl,
      }];
}

export default function InstagramMediaCard({
  post,
}: {
  post: InstagramDiscoveredMedia;
}) {
  const sourceLabels: Record<InstagramMediaSource, string> = {
    recent: "Recent",
    top: "Top",
  };

  return (
    <article className="instagram-result-card">
      <div className="instagram-result-media">
        {mediaAssets(post).map((asset) => (
          <InstagramAssetPreview
            key={asset.id}
            asset={asset}
            label={`Instagram ${asset.mediaType?.toLowerCase() ?? "post"} media`}
          />
        ))}
      </div>
      <div className="instagram-result-content">
        <div className="instagram-result-meta">
          <span>{post.mediaType?.replaceAll("_", " ") ?? "Media type unavailable"}</span>
          <time dateTime={post.timestamp ?? undefined}>
            {formatDateTime(post.timestamp)}
          </time>
        </div>
        {post.caption ? (
          <p className="instagram-result-caption">{post.caption}</p>
        ) : (
          <p className="instagram-result-caption instagram-muted-caption">
            Caption unavailable.
          </p>
        )}
        <div className="instagram-result-attribution">
          {post.username && <span>@{post.username}</span>}
          {post.likesCount !== null && (
            <span>{post.likesCount.toLocaleString()} likes</span>
          )}
        </div>
        <div className="instagram-result-footer">
          <span>{post.sources.map((source) => sourceLabels[source]).join(" · ")}</span>
          {post.permalink ? (
            <a
              className="secondary-button"
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Instagram
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : (
            <span className="instagram-link-unavailable">
              Post link unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
