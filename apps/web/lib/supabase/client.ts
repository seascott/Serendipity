"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "../env";

export function createBrowserSupabase() {
  const env = publicEnv();
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
