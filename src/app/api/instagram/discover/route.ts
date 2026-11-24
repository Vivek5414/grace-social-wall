import { getAdminUser } from "@/lib/auth/admin";
import { handleInstagramDiscoveryRequest } from "@/lib/instagram/discovery-route";

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  let admin;
  try {
    admin = await getAdminUser();
  } catch {
    return jsonResponse({ error: "Unable to verify administrator access." }, 500);
  }

  if (!admin) {
    return jsonResponse({ error: "Administrator access is required." }, 401);
  }

  return handleInstagramDiscoveryRequest(request);
}
