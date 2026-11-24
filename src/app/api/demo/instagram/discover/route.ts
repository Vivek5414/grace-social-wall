import { handleInstagramProviderDiscoveryRequest } from "@/lib/instagram/discovery-route";

export const maxDuration = 60;

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const requestWindowMs = 60_000;
const maximumRequestsPerWindow = 12;
const maximumTrackedClients = 5_000;
const requestsByClient = new Map<string, RateLimitBucket>();

function clientKey(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwardedIp = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return realIp || forwardedIp || "unknown";
}

function retryAfterSeconds(request: Request): number | null {
  const now = Date.now();
  const key = clientKey(request);
  let bucket = requestsByClient.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (requestsByClient.size >= maximumTrackedClients) {
      for (const [client, entry] of requestsByClient) {
        if (entry.resetAt <= now) requestsByClient.delete(client);
      }
      if (requestsByClient.size >= maximumTrackedClients) {
        const oldestClient = requestsByClient.keys().next();
        if (!oldestClient.done) requestsByClient.delete(oldestClient.value);
      }
    }

    bucket = { count: 0, resetAt: now + requestWindowMs };
    requestsByClient.set(key, bucket);
  }

  if (bucket.count >= maximumRequestsPerWindow) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }

  bucket.count += 1;
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const retryAfter = retryAfterSeconds(request);
  if (retryAfter !== null) {
    return Response.json(
      { error: "Demo search limit reached. Wait a bit and try again." },
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  return handleInstagramProviderDiscoveryRequest(request);
}
