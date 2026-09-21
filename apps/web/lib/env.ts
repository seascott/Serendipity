export function publicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key",
  };
}

export function affiliateSecret(): string {
  return process.env.AFFILIATE_CLICK_SECRET ?? "dev-only-affiliate-secret";
}
