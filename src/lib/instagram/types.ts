export type InstagramMediaSource = "recent" | "top";
export type InstagramDiscoveryProviderId = "apify" | "meta";
export type InstagramDateRange = "24h" | "7d" | "30d";

export interface InstagramMediaAsset {
  id: string;
  mediaType: string | null;
  mediaUrl: string | null;
  previewUrl: string | null;
}

export interface InstagramDiscoveredMedia {
  id: string;
  caption: string | null;
  username: string | null;
  likesCount: number | null;
  mediaType: string | null;
  mediaUrl: string | null;
  previewUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  children: InstagramMediaAsset[];
  sources: InstagramMediaSource[];
}

export interface InstagramDiscoveryResponse {
  provider: InstagramDiscoveryProviderId;
  hashtag: string;
  dateRange: InstagramDateRange;
  hashtagId: string | null;
  media: InstagramDiscoveredMedia[];
  pagination: {
    recentAfter: string | null;
    topAfter: string | null;
  };
  warnings: Array<{
    source: InstagramMediaSource;
    message: string;
  }>;
}

export interface InstagramRecentFeedResult {
  hashtag: string;
  posts: InstagramDiscoveredMedia[];
}
