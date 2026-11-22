import "client-only";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export function createClient() {
  const { url, apiKey } = getSupabasePublicConfig();

  return createBrowserClient(url, apiKey);
}