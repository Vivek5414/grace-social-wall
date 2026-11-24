"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";
import PanelHeading from "@/components/dashboard/PanelHeading";
import InstagramMediaCard from "@/components/dashboard/InstagramMediaCard";
import type {
  InstagramDateRange,
  InstagramDiscoveryProviderId,
  InstagramDiscoveryResponse,
  InstagramMediaSource,
  InstagramRecentFeedResult,
} from "@/lib/instagram/types";

function getApiErrorMessage(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return null;
}

interface InstagramSearchContext {
  hashtag: string;
  provider: InstagramDiscoveryProviderId;
  dateRange: InstagramDateRange;
}

function mergeMedia(
  current: InstagramDiscoveryResponse["media"],
  incoming: InstagramDiscoveryResponse["media"],
): InstagramDiscoveryResponse["media"] {
  const merged = [...current];

  for (const post of incoming) {
    const existingIndex = merged.findIndex(
      (existing) =>
        existing.id === post.id ||
        (Boolean(post.permalink) && existing.permalink === post.permalink),
    );
    if (existingIndex < 0) {
      merged.push(post);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      caption: existing.caption ?? post.caption,
      username: existing.username ?? post.username,
      likesCount: existing.likesCount ?? post.likesCount,
      mediaType: existing.mediaType ?? post.mediaType,
      mediaUrl: existing.mediaUrl ?? post.mediaUrl,
      previewUrl: existing.previewUrl ?? post.previewUrl,
      permalink: existing.permalink ?? post.permalink,
      timestamp: existing.timestamp ?? post.timestamp,
      children: existing.children.length > 0 ? existing.children : post.children,
      sources: [...new Set([...existing.sources, ...post.sources])],
    };
  }

  return merged;
}

interface InstagramHashtagDiscoveryProps {
  apiEndpoint?: string;
  publicDemo?: boolean;
  onRecentFeedChange?: (result: InstagramRecentFeedResult | null) => void;
  onOpenRecentFeed?: () => void;
}

export default function InstagramHashtagDiscovery({
  apiEndpoint = "/api/instagram/discover",
  publicDemo = false,
  onRecentFeedChange,
  onOpenRecentFeed,
}: InstagramHashtagDiscoveryProps) {
  const [hashtag, setHashtag] = useState("");
  const [selectedSource, setSelectedSource] =
    useState<InstagramMediaSource>("recent");
  const [selectedProvider, setSelectedProvider] =
    useState<InstagramDiscoveryProviderId>("apify");
  const [selectedDateRange, setSelectedDateRange] =
    useState<InstagramDateRange>("24h");
  const [resultProvider, setResultProvider] =
    useState<InstagramDiscoveryProviderId | null>(null);
  const [activeSearch, setActiveSearch] =
    useState<InstagramSearchContext | null>(null);
  const [hashtagId, setHashtagId] = useState<string | null>(null);
  const [media, setMedia] = useState<InstagramDiscoveryResponse["media"]>([]);
  const [pagination, setPagination] = useState<
    InstagramDiscoveryResponse["pagination"]
  >({ recentAfter: null, topAfter: null });
  const [warnings, setWarnings] = useState<
    InstagramDiscoveryResponse["warnings"]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  async function discover(
    search: InstagramSearchContext,
    cursors?: InstagramDiscoveryResponse["pagination"],
  ) {
    const parameters = new URLSearchParams({ hashtag: search.hashtag });
    if (publicDemo) {
      parameters.set("provider", search.provider);
      parameters.set("dateRange", search.dateRange);
    }
    if (cursors) {
      parameters.set("page", "next");
      if (cursors.recentAfter) parameters.set("recentAfter", cursors.recentAfter);
      if (cursors.topAfter) parameters.set("topAfter", cursors.topAfter);
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiEndpoint}?${parameters.toString()}`,
        { cache: "no-store" },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(body) ?? "Instagram discovery failed.",
        );
      }

      const result = body as InstagramDiscoveryResponse;
      setResultProvider(result.provider);
      setHashtagId(result.hashtagId);
      const nextMedia = cursors ? mergeMedia(media, result.media) : result.media;
      setMedia(nextMedia);
      onRecentFeedChange?.({
        hashtag: search.hashtag,
        posts: nextMedia
          .filter((post) => post.sources.includes("recent"))
          .sort(
            (left, right) =>
              Date.parse(right.timestamp ?? "") -
              Date.parse(left.timestamp ?? ""),
          ),
      });
      if (!cursors) setActiveSearch(search);
      setWarnings(result.warnings);
      setPagination((current) => {
        const failedSources = new Set(result.warnings.map((warning) => warning.source));
        return {
          recentAfter: failedSources.has("recent")
            ? current.recentAfter
            : result.pagination.recentAfter,
          topAfter: failedSources.has("top")
            ? current.topAfter
            : result.pagination.topAfter,
        };
      });
      setSearched(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Instagram discovery failed.",
      );
      if (!cursors) {
        setActiveSearch(null);
        setResultProvider(null);
        setHashtagId(null);
        setMedia([]);
        setPagination({ recentAfter: null, topAfter: null });
        setWarnings([]);
        setSearched(true);
      }
    } finally {
      setBusy(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = hashtag.trim().replace(/^#/, "").trim();
    setHashtag(normalized);
    setActiveSearch(null);
    setResultProvider(null);
    setHashtagId(null);
    setMedia([]);
    setPagination({ recentAfter: null, topAfter: null });
    setWarnings([]);
    setSearched(false);
    onRecentFeedChange?.(null);
    const validHashtag = publicDemo
      ? /^[A-Za-z0-9._-]+$/u.test(normalized)
      : !/[\s#]/u.test(normalized);
    if (!normalized || normalized.length > 100 || !validHashtag) {
      setError("Enter one valid hashtag without spaces or additional # symbols.");
      setSearched(true);
      return;
    }
    void discover({
      hashtag: normalized,
      provider: publicDemo ? selectedProvider : "meta",
      dateRange: publicDemo ? selectedDateRange : "24h",
    });
  }

  const visibleMedia = media
    .filter((post) => post.sources.includes(selectedSource))
    .sort((left, right) => {
      if (selectedSource === "recent") {
        return (
          Date.parse(right.timestamp ?? "") -
          Date.parse(left.timestamp ?? "")
        );
      }
      if (left.likesCount === null) return right.likesCount === null ? 0 : 1;
      if (right.likesCount === null) return -1;
      return right.likesCount - left.likesCount;
    });
  const hasMore = Boolean(
    selectedSource === "recent" ? pagination.recentAfter : pagination.topAfter,
  );
  const nextCursors = {
    recentAfter: pagination.recentAfter,
    topAfter: pagination.topAfter,
  };

  return (
    <section className="content-panel instagram-discovery" aria-label="Instagram hashtag discovery">
      <PanelHeading
        title="Instagram hashtag discovery"
        description={
          publicDemo
            ? "Read-only public Instagram results. Searches are not saved."
            : "Temporary API results for testing. Posts are not saved to Supabase."
        }
      />
      <form className="instagram-discovery-form" onSubmit={submitSearch}>
        <label htmlFor="instagram-hashtag">Hashtag (with or without #)</label>
        <div className="instagram-discovery-controls">
          <div className="instagram-hashtag-input">
            <span aria-hidden="true">#</span>
            <input
              id="instagram-hashtag"
              type="text"
              value={hashtag}
              onChange={(event) => setHashtag(event.target.value)}
              placeholder="Enter a public hashtag"
              maxLength={100}
              required
              disabled={busy}
            />
          </div>
          {publicDemo && (
            <>
              <select
                id="instagram-provider"
                className="instagram-discovery-select"
                aria-label="Search provider"
                value={selectedProvider}
                onChange={(event) => {
                  const provider: InstagramDiscoveryProviderId =
                    event.target.value === "meta" ? "meta" : "apify";
                  setSelectedProvider(provider);
                  if (provider === "meta") setSelectedDateRange("24h");
                }}
                disabled={busy}
              >
                <option value="apify">Apify (default)</option>
                <option value="meta">Meta Graph API</option>
              </select>
              <select
                id="instagram-date-range"
                className="instagram-discovery-select"
                aria-label="Post date range"
                value={selectedDateRange}
                onChange={(event) => {
                  const range: InstagramDateRange =
                    event.target.value === "7d"
                      ? "7d"
                      : event.target.value === "30d"
                        ? "30d"
                        : "24h";
                  setSelectedDateRange(range);
                }}
                disabled={busy}
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d" disabled={selectedProvider === "meta"}>
                  Last 7 days
                </option>
                <option value="30d" disabled={selectedProvider === "meta"}>
                  Last 30 days
                </option>
              </select>
            </>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy && !searched ? (
              <LoaderCircle size={15} className="instagram-spinner" aria-hidden="true" />
            ) : (
              <Search size={15} aria-hidden="true" />
            )}
            {busy && !searched ? "Searching…" : "Search Instagram"}
          </button>
        </div>
      </form>

      <p className="instagram-discovery-note">
        {publicDemo
          ? "Apify searches public post results by default. Meta Graph API remains available for 24-hour results. Searches are temporary and are not saved."
          : "Uses Instagram Graph API with server-side credentials. Instagram limits hashtag searches to 30 unique hashtags per account in a rolling 7-day period; recent results cover posts from the last 24 hours."}
      </p>

      {error && <p className="inline-error instagram-discovery-message" role="alert">{error}</p>}
      {warnings.map((warning) => (
        <p className="inline-error instagram-discovery-message" role="status" key={warning.source}>
          {warning.message}
        </p>
      ))}

      {searched && !error && media.length === 0 && (
        <p className="empty-state instagram-discovery-empty" role="status">
          No public posts were found for this hashtag and date range.
        </p>
      )}

      <div className="instagram-discovery-tabs" role="tablist" aria-label="Instagram post results">
        <button
          type="button"
          id="instagram-recent-tab"
          className={`instagram-discovery-tab ${selectedSource === "recent" ? "active" : ""}`}
          role="tab"
          aria-selected={selectedSource === "recent"}
          aria-controls="instagram-results-panel"
          onClick={() => setSelectedSource("recent")}
        >
          Recent Posts
        </button>
        <button
          type="button"
          id="instagram-top-tab"
          className={`instagram-discovery-tab ${selectedSource === "top" ? "active" : ""}`}
          role="tab"
          aria-selected={selectedSource === "top"}
          aria-controls="instagram-results-panel"
          onClick={() => setSelectedSource("top")}
        >
          Top Posts
        </button>
      </div>

      <div
        id="instagram-results-panel"
        role="tabpanel"
        aria-labelledby={selectedSource === "recent" ? "instagram-recent-tab" : "instagram-top-tab"}
        tabIndex={0}
      >
        {searched && resultProvider && (
          <div className="instagram-discovery-summary" role="status">
            <span>
              Provider: <strong>{resultProvider}</strong>
              {activeSearch && (
                <> · #{activeSearch.hashtag} · {activeSearch.dateRange}</>
              )}
              {hashtagId && <> · Hashtag ID: <strong>{hashtagId}</strong></>}
            </span>
            <span>{media.length} unique posts loaded</span>
          </div>
        )}
        {onOpenRecentFeed && media.some((post) => post.sources.includes("recent")) && (
          <div className="instagram-load-more">
            <button
              type="button"
              className="secondary-button"
              onClick={onOpenRecentFeed}
            >
              Show recent posts in Social Posts
            </button>
          </div>
        )}

        {!searched && !busy && (
          <p className="empty-state instagram-discovery-empty" role="status">
            Search a hashtag to view public Instagram posts.
          </p>
        )}
        {busy && !searched && (
          <p className="empty-state instagram-discovery-empty" role="status">
            Searching Instagram…
          </p>
        )}
        {searched && (media.length > 0 || hashtagId) && (
          <>
            {visibleMedia.length > 0 ? (
              <div className="instagram-result-grid">
                {visibleMedia.map((post) => (
                  <InstagramMediaCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <p className="empty-state instagram-discovery-empty" role="status">
                No public {selectedSource} posts are currently available for this hashtag.
              </p>
            )}

            {hasMore && (
              <div className="instagram-load-more">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    if (activeSearch) {
                      void discover(activeSearch, nextCursors);
                    }
                  }}
                >
                  {busy ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
