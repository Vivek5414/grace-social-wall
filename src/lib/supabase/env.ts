function readSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return { url, apiKey: publishableKey || anonKey };
}

export function hasSupabasePublicConfig(): boolean {
  const { url, apiKey } = readSupabasePublicConfig();
  return Boolean(url && apiKey);
}

export function getSupabasePublicConfig() {
  const { url, apiKey } = readSupabasePublicConfig();

  if (!url || !apiKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, apiKey };
}
