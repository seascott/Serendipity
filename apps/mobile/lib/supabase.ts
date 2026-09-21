import { createSerendipityClient } from "@serendipity/api";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key";

export const supabase = createSerendipityClient(url, anonKey);
