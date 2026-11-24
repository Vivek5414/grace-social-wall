import "server-only";
import {
  discoverInstagramHashtag,
  InstagramConfigurationError,
  InstagramGraphApiError,
  InstagramRateLimitError,
  getInstagramGraphErrorMessage,
} from "@/lib/instagram/graph-api";
import { apifyInstagramProvider } from "@/lib/instagram/apify-provider";
import { metaInstagramProvider } from "@/lib/instagram/meta-provider";
import { InstagramProviderError } from "@/lib/instagram/provider-contract";
import type {
  InstagramDateRange,
  InstagramDiscoveryProviderId,
} from "@/lib/instagram/types";

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validCursor(value: string | null): value is string {
  return value !== null && value.length > 0 && value.length <= 2048;
}

function dateRange(value: string | null): value is InstagramDateRange {
  return value === "24h" || value === "7d" || value === "30d";
}

function providerId(value: string | null): value is InstagramDiscoveryProviderId {
  return value === "apify" || value === "meta";
}

export async function handleInstagramDiscoveryRequest(
  request: Request,
): Promise<Response> {
  const parameters = new URL(request.url).searchParams;
  const hashtag = (parameters.get("hashtag") ?? "").trim().replace(/^#/, "");
  const page = parameters.get("page") === "next" ? "next" : "initial";
  const recentAfter = parameters.get("recentAfter");
  const topAfter = parameters.get("topAfter");

  if (
    !hashtag ||
    hashtag.length > 100 ||
    /[\s#]/u.test(hashtag) ||
    (parameters.has("page") && page !== "next") ||
    (recentAfter !== null && !validCursor(recentAfter)) ||
    (topAfter !== null && !validCursor(topAfter)) ||
    (page === "next" && !validCursor(recentAfter) && !validCursor(topAfter))
  ) {
    return jsonResponse({ error: "Enter a valid hashtag and try again." }, 400);
  }

  try {
    const result = await discoverInstagramHashtag(hashtag, {
      page,
      recentAfter: validCursor(recentAfter) ? recentAfter : undefined,
      topAfter: validCursor(topAfter) ? topAfter : undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof InstagramConfigurationError) {
      return jsonResponse(
        { error: "Instagram discovery is not configured on the server." },
        503,
      );
    }
    if (error instanceof InstagramRateLimitError) {
      return jsonResponse(
        { error: getInstagramGraphErrorMessage(error) },
        429,
      );
    }
    if (error instanceof InstagramGraphApiError) {
      return jsonResponse(
        { error: getInstagramGraphErrorMessage(error) },
        502,
      );
    }
    return jsonResponse({ error: "Instagram discovery failed." }, 500);
  }
}

export async function handleInstagramProviderDiscoveryRequest(
  request: Request,
): Promise<Response> {
  const parameters = new URL(request.url).searchParams;
  const hashtag = (parameters.get("hashtag") ?? "").trim().replace(/^#/, "");
  const requestedProvider = parameters.get("provider") ?? "apify";
  const requestedDateRange = parameters.get("dateRange") ?? "24h";
  const page = parameters.get("page") === "next" ? "next" : "initial";
  const recentAfter = parameters.get("recentAfter");
  const topAfter = parameters.get("topAfter");

  if (
    !hashtag ||
    hashtag.length > 100 ||
    !/^[A-Za-z0-9._-]+$/u.test(hashtag) ||
    !providerId(requestedProvider) ||
    !dateRange(requestedDateRange) ||
    (parameters.has("page") && page !== "next") ||
    (recentAfter !== null && !validCursor(recentAfter)) ||
    (topAfter !== null && !validCursor(topAfter)) ||
    (page === "next" && !validCursor(recentAfter) && !validCursor(topAfter))
  ) {
    return jsonResponse(
      { error: "Enter a valid hashtag, provider, and date range." },
      400,
    );
  }

  if (requestedProvider === "meta" && requestedDateRange !== "24h") {
    return jsonResponse(
      {
        provider: "meta",
        error:
          "Meta Graph API recent hashtag media is limited to 24 hours. Choose 24 hours or use Apify.",
      },
      400,
    );
  }

  const provider =
    requestedProvider === "apify"
      ? apifyInstagramProvider
      : metaInstagramProvider;

  try {
    const result = await provider.search({
      hashtag,
      dateRange: requestedDateRange,
      page,
      recentAfter: validCursor(recentAfter) ? recentAfter : undefined,
      topAfter: validCursor(topAfter) ? topAfter : undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof InstagramConfigurationError) {
      return jsonResponse(
        {
          provider: requestedProvider,
          error: "Instagram discovery is not configured on the server.",
        },
        503,
      );
    }
    if (error instanceof InstagramProviderError) {
      return jsonResponse(
        { provider: requestedProvider, error: error.message },
        error.httpStatus,
      );
    }
    if (error instanceof InstagramRateLimitError) {
      return jsonResponse(
        {
          provider: requestedProvider,
          error: getInstagramGraphErrorMessage(error),
        },
        429,
      );
    }
    if (error instanceof InstagramGraphApiError) {
      return jsonResponse(
        {
          provider: requestedProvider,
          error: getInstagramGraphErrorMessage(error),
        },
        502,
      );
    }
    console.error("[instagram discovery] Unexpected provider error", {
      provider: requestedProvider,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse(
      {
        provider: requestedProvider,
        error: "Instagram discovery failed. Try again later.",
      },
      500,
    );
  }
}
