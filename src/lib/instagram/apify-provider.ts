import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  safeInstagramMediaUrl,
  safeInstagramPermalink,
} from "./graph-api";
import {
  InstagramProviderError,
  type InstagramHashtagProvider,
  type InstagramProviderSearchInput,
} from "./provider-contract";
import type {
  InstagramDateRange,
  InstagramDiscoveredMedia,
  InstagramDiscoveryResponse,
  InstagramMediaAsset,
} from "./types";

const actorRunEndpoint =
  "https://api.apify.com/v2/actors/apify~instagram-scraper/runs";
const actorRunTimeoutSeconds = 45;
const actorRunWaitSeconds = 45;
const actorStatusWaitSeconds = 10;
const requestTimeoutMilliseconds = 55_000;
const pageSize = 10;
const maximumActorResults = 30;
const maximumChargeUsd = 0.5;
const cursorLifetimeMilliseconds = 30 * 60 * 1000;
const dateRangeMilliseconds: Record<InstagramDateRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};
const actorDateFilters: Record<InstagramDateRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};
const inFlightSearches = new Map<
  string,
  Promise<InstagramDiscoveryResponse>
>();

interface ActorRecord {
  [key: string]: unknown;
}

interface DatasetCursor {
  version: 1;
  datasetId: string;
  offset: number;
  hashtag: string;
  dateRange: InstagramDateRange;
  expiresAt: number;
}

interface DatasetPage {
  items: unknown[];
  hasMore: boolean;
}

function isRecord(value: unknown): value is ActorRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isInstagramDateRange(value: unknown): value is InstagramDateRange {
  return value === "24h" || value === "7d" || value === "30d";
}

function normalizeMediaType(value: unknown): string | null {
  const mediaType = stringField(value);
  if (!mediaType) return null;

  switch (mediaType.toLowerCase()) {
    case "image":
      return "IMAGE";
    case "video":
      return "VIDEO";
    case "sidecar":
    case "carousel":
    case "carousel_album":
      return "CAROUSEL_ALBUM";
    default:
      return mediaType.toUpperCase();
  }
}

function safeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((image) => {
    const url = safeInstagramMediaUrl(image);
    return url ? [url] : [];
  });
}

function normalizeAsset(value: unknown): InstagramMediaAsset | null {
  if (!isRecord(value)) return null;

  const id = stringField(value.id) ?? stringField(value.shortCode);
  if (!id) return null;

  const mediaType = normalizeMediaType(value.type);
  const displayUrl =
    safeInstagramMediaUrl(value.displayUrl) ?? safeImages(value.images)[0] ?? null;
  const videoUrl = safeInstagramMediaUrl(value.videoUrl);

  return {
    id,
    mediaType,
    mediaUrl: mediaType === "VIDEO" ? videoUrl : displayUrl,
    previewUrl: displayUrl,
  };
}

function normalizePost(value: unknown): InstagramDiscoveredMedia | null {
  if (!isRecord(value)) return null;

  const asset = normalizeAsset(value);
  if (!asset) return null;

  const timestamp = stringField(value.timestamp);
  const timestampMilliseconds = timestamp ? Date.parse(timestamp) : Number.NaN;
  const validTimestamp = Number.isFinite(timestampMilliseconds)
    ? timestamp
    : null;
  const childPosts = Array.isArray(value.childPosts) ? value.childPosts : [];
  const likesCount =
    typeof value.likesCount === "number" &&
    Number.isInteger(value.likesCount) &&
    value.likesCount >= 0
      ? value.likesCount
      : null;

  return {
    id: asset.id,
    caption: stringField(value.caption),
    username: stringField(value.ownerUsername),
    likesCount,
    mediaType: asset.mediaType,
    mediaUrl: asset.mediaUrl,
    previewUrl: asset.previewUrl,
    permalink: safeInstagramPermalink(value.url),
    timestamp: validTimestamp,
    children: childPosts.flatMap((child) => {
      const normalized = normalizeAsset(child);
      return normalized ? [normalized] : [];
    }),
    sources: ["recent", "top"],
  };
}

export function normalizeApifyDataset(
  payload: unknown,
  hashtag: string,
  dateRange: InstagramDateRange,
  now = Date.now(),
): InstagramDiscoveryResponse {
  if (!Array.isArray(payload)) {
    throw new InstagramProviderError(
      502,
      "Apify returned an unexpected dataset response.",
    );
  }

  const cutoff = now - dateRangeMilliseconds[dateRange];
  const media = payload
    .map(normalizePost)
    .filter((post): post is InstagramDiscoveredMedia => post !== null)
    .filter((post) => {
      const timestamp = post.timestamp ? Date.parse(post.timestamp) : Number.NaN;
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now;
    })
    .sort(
      (left, right) =>
        Date.parse(right.timestamp ?? "") - Date.parse(left.timestamp ?? ""),
    )
    .slice(0, pageSize);

  return {
    provider: "apify",
    hashtag,
    dateRange,
    hashtagId: null,
    media,
    pagination: { recentAfter: null, topAfter: null },
    warnings: [],
  };
}

function cursorKey(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

function encodeCursor(cursor: DatasetCursor, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cursorKey(token), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(cursor), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

function decodeCursor(
  value: string,
  token: string,
  hashtag: string,
  dateRange: InstagramDateRange,
): DatasetCursor | null {
  try {
    const encoded = Buffer.from(value, "base64url");
    if (encoded.length <= 28) return null;

    const iv = encoded.subarray(0, 12);
    const tag = encoded.subarray(12, 28);
    const encrypted = encoded.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", cursorKey(token), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    const cursor: unknown = JSON.parse(plaintext);

    if (
      !isRecord(cursor) ||
      cursor.version !== 1 ||
      typeof cursor.datasetId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/u.test(cursor.datasetId) ||
      typeof cursor.offset !== "number" ||
      !Number.isSafeInteger(cursor.offset) ||
      cursor.offset <= 0 ||
      cursor.offset >= maximumActorResults ||
      cursor.offset % pageSize !== 0 ||
      typeof cursor.hashtag !== "string" ||
      cursor.hashtag !== hashtag.toLowerCase() ||
      !isInstagramDateRange(cursor.dateRange) ||
      cursor.dateRange !== dateRange ||
      typeof cursor.expiresAt !== "number" ||
      cursor.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      version: 1,
      datasetId: cursor.datasetId,
      offset: cursor.offset,
      hashtag: cursor.hashtag,
      dateRange: cursor.dateRange,
      expiresAt: cursor.expiresAt,
    };
  } catch {
    return null;
  }
}

function providerErrorForFetch(error: unknown): InstagramProviderError {
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return new InstagramProviderError(
      504,
      "Apify search timed out. Try again later.",
    );
  }
  return new InstagramProviderError(
    502,
    "Apify could not be reached. Try again later.",
  );
}

async function fetchApify(
  url: URL,
  token: string,
  method: "GET" | "POST",
  body?: string,
): Promise<Response> {
  try {
    return await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
  } catch (error) {
    throw providerErrorForFetch(error);
  }
}

function throwApifyResponseError(status: number): never {
  if (status === 401) {
    throw new InstagramProviderError(
      503,
      "Apify rejected the server access token.",
    );
  }
  if (status === 403) {
    throw new InstagramProviderError(
      503,
      "The Apify token does not have permission for this operation.",
    );
  }
  if (status === 429) {
    throw new InstagramProviderError(
      429,
      "Apify rate limit reached. Wait before trying again.",
    );
  }
  if (status === 402) {
    throw new InstagramProviderError(
      503,
      "Apify billing or spending limits prevented this search.",
    );
  }
  if (status === 408) {
    throw new InstagramProviderError(
      504,
      "Apify search timed out. Try again later.",
    );
  }
  throw new InstagramProviderError(
    502,
    "Apify could not complete the Instagram search.",
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new InstagramProviderError(
      502,
      "Apify returned an unreadable response.",
    );
  }
}

function actorRunData(payload: unknown): ActorRecord {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new InstagramProviderError(
      502,
      "Apify returned an unexpected actor-run response.",
    );
  }
  return payload.data;
}

async function getActorRun(
  runId: string,
  token: string,
): Promise<ActorRecord> {
  const url = new URL(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`,
  );
  url.searchParams.set("waitForFinish", String(actorStatusWaitSeconds));
  const response = await fetchApify(url, token, "GET");
  if (!response.ok) throwApifyResponseError(response.status);
  return actorRunData(await readJson(response));
}

async function startActorRun(
  hashtag: string,
  dateRange: InstagramDateRange,
  token: string,
): Promise<string> {
  const url = new URL(actorRunEndpoint);
  url.search = new URLSearchParams({
    timeout: String(actorRunTimeoutSeconds),
    waitForFinish: String(actorRunWaitSeconds),
    maxTotalChargeUsd: String(maximumChargeUsd),
    restartOnError: "false",
  }).toString();

  const response = await fetchApify(
    url,
    token,
    "POST",
    JSON.stringify({
      resultsType: "posts",
      directUrls: [
        `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`,
      ],
      resultsLimit: maximumActorResults,
      onlyPostsNewerThan: actorDateFilters[dateRange],
      addParentData: false,
    }),
  );
  if (!response.ok) throwApifyResponseError(response.status);

  let run = actorRunData(await readJson(response));
  const runStatus = stringField(run.status);
  if (
    runStatus === "READY" ||
    runStatus === "RUNNING" ||
    runStatus === "TIMING-OUT"
  ) {
    const runId = stringField(run.id);
    if (!runId || !/^[A-Za-z0-9_-]{1,128}$/u.test(runId)) {
      throw new InstagramProviderError(
        502,
        "Apify did not return a valid actor-run identifier.",
      );
    }
    run = await getActorRun(runId, token);
  }

  if (stringField(run.status) !== "SUCCEEDED") {
    const timedOut =
      run.status === "TIMED-OUT" || run.status === "TIMING-OUT";
    throw new InstagramProviderError(
      timedOut ? 504 : 502,
      timedOut
        ? "Apify search timed out. Try again later."
        : "Apify scraper run did not complete successfully.",
    );
  }

  const datasetId = stringField(run.defaultDatasetId);
  if (!datasetId || !/^[A-Za-z0-9_-]{1,128}$/u.test(datasetId)) {
    throw new InstagramProviderError(
      502,
      "Apify did not return a valid dataset identifier.",
    );
  }
  return datasetId;
}

async function readDatasetPage(
  datasetId: string,
  offset: number,
  token: string,
): Promise<DatasetPage> {
  const url = new URL(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`,
  );
  url.search = new URLSearchParams({
    format: "json",
    offset: String(offset),
    limit: String(pageSize + 1),
    desc: "true",
  }).toString();

  const response = await fetchApify(url, token, "GET");
  if (!response.ok) throwApifyResponseError(response.status);

  const payload = await readJson(response);
  if (!Array.isArray(payload)) {
    throw new InstagramProviderError(
      502,
      "Apify returned an unexpected dataset response.",
    );
  }

  const nextOffset = offset + pageSize;
  const totalHeader = response.headers.get("X-Apify-Pagination-Total");
  const total = totalHeader && /^\d+$/u.test(totalHeader)
    ? Number(totalHeader)
    : null;
  const hasMore =
    nextOffset < maximumActorResults &&
    (total !== null ? nextOffset < total : payload.length > pageSize);

  return {
    items: payload.slice(0, pageSize),
    hasMore,
  };
}

async function searchApify(
  input: InstagramProviderSearchInput,
  token: string,
): Promise<InstagramDiscoveryResponse> {
  const cursorValue = input.recentAfter ?? input.topAfter;
  if (
    input.page === "next" &&
    ((!cursorValue) ||
      (input.recentAfter &&
        input.topAfter &&
        input.recentAfter !== input.topAfter))
  ) {
    throw new InstagramProviderError(
      400,
      "The Apify pagination cursor is invalid. Search again to continue.",
    );
  }

  let datasetId: string;
  let offset = 0;
  if (input.page === "initial") {
    datasetId = await startActorRun(input.hashtag, input.dateRange, token);
  } else {
    if (!cursorValue) {
      throw new InstagramProviderError(
        400,
        "The Apify pagination cursor is invalid. Search again to continue.",
      );
    }
    const cursor = decodeCursor(
      cursorValue,
      token,
      input.hashtag,
      input.dateRange,
    );
    if (!cursor) {
      throw new InstagramProviderError(
        400,
        "The Apify pagination cursor is invalid or expired. Search again.",
      );
    }
    datasetId = cursor.datasetId;
    offset = cursor.offset;
  }

  const datasetPage = await readDatasetPage(datasetId, offset, token);
  const normalized = normalizeApifyDataset(
    datasetPage.items,
    input.hashtag,
    input.dateRange,
  );
  const nextOffset = offset + pageSize;
  const nextCursor =
    datasetPage.hasMore && nextOffset < maximumActorResults
      ? encodeCursor(
          {
            version: 1,
            datasetId,
            offset: nextOffset,
            hashtag: input.hashtag.toLowerCase(),
            dateRange: input.dateRange,
            expiresAt: Date.now() + cursorLifetimeMilliseconds,
          },
          token,
        )
      : null;

  return {
    ...normalized,
    pagination: {
      recentAfter: nextCursor,
      topAfter: nextCursor,
    },
  };
}

export const apifyInstagramProvider: InstagramHashtagProvider = {
  id: "apify",
  async search(input: InstagramProviderSearchInput) {
    const token = process.env.APIFY_API_TOKEN?.trim();
    if (!token) {
      throw new InstagramProviderError(
        503,
        "Apify search is not configured on the server.",
      );
    }

    const cursorValue = input.recentAfter ?? input.topAfter;
    if (
      input.page === "next" &&
      (!cursorValue ||
        (input.recentAfter &&
          input.topAfter &&
          input.recentAfter !== input.topAfter))
    ) {
      throw new InstagramProviderError(
        400,
        "The Apify pagination cursor is invalid. Search again to continue.",
      );
    }

    const cursorKeyValue = cursorValue ?? "initial";
    const key = `${input.hashtag.toLowerCase()}:${input.dateRange}:${cursorKeyValue}`;
    const currentRequest = inFlightSearches.get(key);
    if (currentRequest) return currentRequest;

    const request = searchApify(input, token);
    inFlightSearches.set(key, request);
    const clearRequest = () => {
      if (inFlightSearches.get(key) === request) {
        inFlightSearches.delete(key);
      }
    };
    void request.then(clearRequest, clearRequest);

    return request;
  },
};
