import "server-only";

import type {
  InstagramDiscoveredMedia,
  InstagramDiscoveryResponse,
  InstagramMediaAsset,
} from "./types";
export type {
  InstagramDateRange,
  InstagramDiscoveredMedia,
  InstagramDiscoveryProviderId,
  InstagramDiscoveryResponse,
  InstagramMediaAsset,
  InstagramMediaSource,
  InstagramRecentFeedResult,
} from "./types";

export type InstagramGraphEndpoint =
  | "ig_hashtag_search"
  | "recent_media"
  | "top_media";

export interface InstagramGraphFailureDetails {
  endpoint: InstagramGraphEndpoint;
  httpStatus: number | null;
  metaMessage: string | null;
  metaCode: number | null;
  metaSubcode: number | null;
}

export class InstagramConfigurationError extends Error {}

export class InstagramGraphApiError extends Error {
  constructor(readonly details: InstagramGraphFailureDetails) {
    super(details.metaMessage ?? "Instagram Graph API request failed.");
    this.name = "InstagramGraphApiError";
  }
}

export class InstagramRateLimitError extends InstagramGraphApiError {}

interface InstagramConfig {
  accessToken: string;
  userId: string;
  apiVersion: string;
}

interface GraphRecord {
  [key: string]: unknown;
}

interface GraphPage {
  items: InstagramDiscoveredMedia[];
  after: string | null;
}

interface GraphResponse {
  payload: unknown;
  httpStatus: number;
}

const graphBaseUrl = "https://graph.facebook.com";
const mediaFields =
  "id,caption,media_type,media_url,permalink,timestamp,like_count,children{id,media_type,media_url,permalink,timestamp}";
const mediaHosts = ["cdninstagram.com", "fbcdn.net", "fbsbx.com"];
const rateLimitCodes = new Set([4, 17, 32, 613]);

function isRecord(value: unknown): value is GraphRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfig(): InstagramConfig {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_USER_ID?.trim();
  const apiVersion = process.env.META_GRAPH_API_VERSION?.trim();

  if (
    !accessToken ||
    !userId ||
    !apiVersion ||
    !/^\d+$/.test(userId) ||
    !/^v\d+\.\d+$/.test(apiVersion)
  ) {
    throw new InstagramConfigurationError();
  }

  return { accessToken, userId, apiVersion };
}

function safeMetaMessage(value: unknown, accessToken: string): string | null {
  if (typeof value !== "string") return null;

  let message = value.split(accessToken).join("[redacted]");
  message = message
    .replace(
      /\b(access_token|appsecret_proof|client_secret)\s*[=:]\s*[^&\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL redacted]")
    .replace(/\s+/g, " ")
    .trim();

  return message.length > 0 ? message.slice(0, 300) : null;
}

function numericErrorField(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function createGraphApiError(
  details: InstagramGraphFailureDetails,
  rateLimited = false,
): InstagramGraphApiError {
  console.error("[instagram graph api] Request failed", details);
  return rateLimited
    ? new InstagramRateLimitError(details)
    : new InstagramGraphApiError(details);
}

export function getInstagramGraphErrorMessage(
  error: InstagramGraphApiError,
): string {
  const { endpoint, httpStatus, metaCode, metaSubcode, metaMessage } =
    error.details;
  const status = httpStatus === null ? "" : ` (HTTP ${httpStatus})`;
  const metaError = metaCode === null
    ? ""
    : ` (Meta code ${metaCode}${metaSubcode === null ? "" : `, subcode ${metaSubcode}`})`;

  if (error instanceof InstagramRateLimitError) {
    return `Instagram rate limit reached during ${endpoint}${status}${metaError}. Wait a bit and try again.${metaMessage ? ` ${metaMessage}` : ""}`;
  }
  if (metaCode === 190 && metaSubcode === 463) {
    return `Instagram access token expired during ${endpoint}${status}${metaError}. Update INSTAGRAM_ACCESS_TOKEN on the server and try again.`;
  }
  if (metaCode === 190) {
    return `Instagram rejected the access token during ${endpoint}${status}${metaError}. Check the server-side token and its permissions.`;
  }

  return `Instagram ${endpoint} failed${status}${metaError}.${metaMessage ? ` ${metaMessage}` : ""}`;
}

function graphUrl(
  config: InstagramConfig,
  path: string,
  parameters: Record<string, string>,
): URL {
  const url = new URL(`${config.apiVersion}/${path}`, `${graphBaseUrl}/`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function graphGet(
  config: InstagramConfig,
  path: string,
  parameters: Record<string, string>,
  endpoint: InstagramGraphEndpoint,
): Promise<GraphResponse> {
  let response: Response;

  try {
    response = await fetch(graphUrl(config, path, parameters), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${config.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw createGraphApiError({
      endpoint,
      httpStatus: null,
      metaMessage: "A network error occurred before Meta returned a response.",
      metaCode: null,
      metaSubcode: null,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw createGraphApiError({
      endpoint,
      httpStatus: response.status,
      metaMessage: "Meta returned a non-JSON response.",
      metaCode: null,
      metaSubcode: null,
    });
  }

  const graphError =
    isRecord(payload) && "error" in payload && isRecord(payload.error)
      ? payload.error
      : null;
  const hasGraphError = isRecord(payload) && "error" in payload;
  const errorCode = numericErrorField(graphError?.code);
  const errorSubcode = numericErrorField(graphError?.error_subcode);

  if (!response.ok || !isRecord(payload) || hasGraphError) {
    const details: InstagramGraphFailureDetails = {
      endpoint,
      httpStatus: response.status,
      metaMessage: safeMetaMessage(
        graphError?.message,
        config.accessToken,
      ) ?? `Meta returned HTTP ${response.status} without a usable error message.`,
      metaCode: errorCode,
      metaSubcode: errorSubcode,
    };
    throw createGraphApiError(
      details,
      response.status === 429 ||
        (errorCode !== null && rateLimitCodes.has(errorCode)),
    );
  }

  return { payload, httpStatus: response.status };
}

export function safeInstagramMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const allowedHost = mediaHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );

    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      allowedHost
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function safeInstagramPermalink(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "instagram.com" ||
        url.hostname === "www.instagram.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseChildren(value: unknown, parentId: string): InstagramMediaAsset[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];

  return value.data.flatMap((child, index) => {
    if (!isRecord(child)) return [];
    return [
      {
        id: safeString(child.id) ?? `${parentId}-child-${index}`,
        mediaType: safeString(child.media_type),
        mediaUrl: safeInstagramMediaUrl(child.media_url),
        previewUrl: safeInstagramMediaUrl(child.media_url),
      },
    ];
  });
}

function parseMedia(value: unknown): InstagramDiscoveredMedia[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = safeString(item.id);
    if (!id) return [];

    return [
      {
        id,
        caption: safeString(item.caption),
        username: null,
        likesCount:
          typeof item.like_count === "number" &&
          Number.isInteger(item.like_count) &&
          item.like_count >= 0
            ? item.like_count
            : null,
        mediaType: safeString(item.media_type),
        mediaUrl: safeInstagramMediaUrl(item.media_url),
        previewUrl: safeInstagramMediaUrl(item.media_url),
        permalink: safeInstagramPermalink(item.permalink),
        timestamp: safeString(item.timestamp),
        children: parseChildren(item.children, id),
        sources: [],
      },
    ];
  });
}

function parseGraphPage(payload: unknown): GraphPage | null {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return null;
  }

  const paging = isRecord(payload.paging) ? payload.paging : null;
  const cursors = paging && isRecord(paging.cursors) ? paging.cursors : null;
  const hasNext = Boolean(paging && typeof paging.next === "string");
  const after = cursors ? safeString(cursors.after) : null;

  return {
    items: parseMedia(payload.data),
    after: hasNext && after && after.length <= 2048 ? after : null,
  };
}

async function findHashtagId(
  config: InstagramConfig,
  hashtag: string,
): Promise<string | null> {
  const response = await graphGet(
    config,
    "ig_hashtag_search",
    {
      user_id: config.userId,
      q: hashtag,
      fields: "id",
    },
    "ig_hashtag_search",
  );
  const payload = response.payload;

  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw createGraphApiError({
      endpoint: "ig_hashtag_search",
      httpStatus: response.httpStatus,
      metaMessage: "Meta returned an unexpected hashtag-search response.",
      metaCode: null,
      metaSubcode: null,
    });
  }

  const result = payload.data.find(
    (item) => isRecord(item) && typeof item.id === "string" && /^\d+$/.test(item.id),
  );
  return isRecord(result) ? safeString(result.id) : null;
}

async function fetchMediaPage(
  config: InstagramConfig,
  hashtagId: string,
  edge: "recent_media" | "top_media",
  after?: string,
): Promise<GraphPage> {
  const parameters: Record<string, string> = {
    user_id: config.userId,
    fields: mediaFields,
    limit: "10",
  };
  if (after) parameters.after = after;

  const response = await graphGet(
    config,
    `${hashtagId}/${edge}`,
    parameters,
    edge,
  );
  const page = parseGraphPage(response.payload);
  if (!page) {
    throw createGraphApiError({
      endpoint: edge,
      httpStatus: response.httpStatus,
      metaMessage: "Meta returned an unexpected media response.",
      metaCode: null,
      metaSubcode: null,
    });
  }
  return page;
}

function combineMedia(
  recent: InstagramDiscoveredMedia[],
  top: InstagramDiscoveredMedia[],
): InstagramDiscoveredMedia[] {
  const combined = new Map<string, InstagramDiscoveredMedia>();

  for (const [source, posts] of [
    ["recent", recent],
    ["top", top],
  ] as const) {
    for (const post of posts) {
      const current = combined.get(post.id);
      if (!current) {
        combined.set(post.id, { ...post, sources: [source] });
        continue;
      }

      combined.set(post.id, {
        ...current,
        caption: current.caption ?? post.caption,
        username: current.username ?? post.username,
        likesCount: current.likesCount ?? post.likesCount,
        mediaType: current.mediaType ?? post.mediaType,
        mediaUrl: current.mediaUrl ?? post.mediaUrl,
        previewUrl: current.previewUrl ?? post.previewUrl,
        permalink: current.permalink ?? post.permalink,
        timestamp: current.timestamp ?? post.timestamp,
        children: current.children.length > 0 ? current.children : post.children,
        sources: current.sources.includes(source)
          ? current.sources
          : [...current.sources, source],
      });
    }
  }

  return [...combined.values()];
}

export async function discoverInstagramHashtag(
  hashtag: string,
  options: {
    page: "initial" | "next";
    recentAfter?: string;
    topAfter?: string;
  },
): Promise<InstagramDiscoveryResponse> {
  const config = getConfig();
  const hashtagId = await findHashtagId(config, hashtag);

  if (!hashtagId) {
    return {
      provider: "meta",
      hashtag,
      dateRange: "24h",
      hashtagId: null,
      media: [],
      pagination: { recentAfter: null, topAfter: null },
      warnings: [],
    };
  }

  const loadRecent = options.page === "initial" || Boolean(options.recentAfter);
  const loadTop = options.page === "initial" || Boolean(options.topAfter);
  const recentRequest = loadRecent
    ? fetchMediaPage(config, hashtagId, "recent_media", options.recentAfter)
    : Promise.resolve(null);
  const topRequest = loadTop
    ? fetchMediaPage(config, hashtagId, "top_media", options.topAfter)
    : Promise.resolve(null);
  const [recentResult, topResult] = await Promise.allSettled([
    recentRequest,
    topRequest,
  ]);
  const recent = recentResult.status === "fulfilled" ? recentResult.value : null;
  const top = topResult.status === "fulfilled" ? topResult.value : null;

  if (!recent && !top) {
    const failures: unknown[] = [];
    if (recentResult.status === "rejected") failures.push(recentResult.reason);
    if (topResult.status === "rejected") failures.push(topResult.reason);
    const rateLimitFailure = failures.find(
      (error): error is InstagramRateLimitError =>
        error instanceof InstagramRateLimitError,
    );
    if (rateLimitFailure) throw rateLimitFailure;
    const graphFailure = failures.find(
      (error): error is InstagramGraphApiError =>
        error instanceof InstagramGraphApiError,
    );
    if (graphFailure) throw graphFailure;
    throw createGraphApiError({
      endpoint: loadRecent ? "recent_media" : "top_media",
      httpStatus: null,
      metaMessage: "Instagram media requests failed unexpectedly.",
      metaCode: null,
      metaSubcode: null,
    });
  }

  function getMediaWarning(error: unknown, endpoint: InstagramGraphEndpoint) {
    if (error instanceof InstagramGraphApiError) {
      return getInstagramGraphErrorMessage(error);
    }
    return `Instagram ${endpoint} could not be loaded.`;
  }

  const warnings: InstagramDiscoveryResponse["warnings"] = [];
  if (loadRecent && recentResult.status === "rejected") {
    warnings.push({
      source: "recent",
      message: getMediaWarning(recentResult.reason, "recent_media"),
    });
  }
  if (loadTop && topResult.status === "rejected") {
    warnings.push({
      source: "top",
      message: getMediaWarning(topResult.reason, "top_media"),
    });
  }

  return {
    provider: "meta",
    hashtag,
    dateRange: "24h",
    hashtagId,
    media: combineMedia(recent?.items ?? [], top?.items ?? []),
    pagination: {
      recentAfter: recent?.after ?? null,
      topAfter: top?.after ?? null,
    },
    warnings,
  };
}
