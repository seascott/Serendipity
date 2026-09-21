import { createSerendipityClient, explore } from "@serendipity/api/core";
import type { OccurrenceView } from "@serendipity/catalog";
import { getCatalog, hydrateOccurrences } from "@serendipity/catalog/server";
import type { Family } from "@serendipity/domain";
import { publicEnv } from "../env";

/**
 * Where Explore reads materialized occurrences from.
 *
 * - `catalog`: the in-memory build of `packages/catalog` (default; no database needed).
 * - `supabase`: the `explore()` RPC against the seeded database, joined back onto
 *   the catalog for editorial copy. Same ids, same ranking (see jobs/src/smoke.ts).
 *
 * Selected with `SERENDIPITY_DATA_SOURCE`; unknown values fall back to `catalog`.
 */
export type OccurrenceSource = "catalog" | "supabase";

export function occurrenceSource(): OccurrenceSource {
  return process.env.SERENDIPITY_DATA_SOURCE === "supabase" ? "supabase" : "catalog";
}

export type ExploreQuery = {
  origin: { lat: number; lng: number };
  from: Date;
  to: Date;
  families?: Family[] | null;
};

/** Widest tier plus the "coming up" horizon, so tiering stays a pure function of the rows. */
const SEARCH_RADIUS_M = 2_000_000;
const UPCOMING_HORIZON_MS = 90 * 86_400_000;

export async function loadOccurrences(
  query: ExploreQuery,
  source: OccurrenceSource = occurrenceSource(),
): Promise<OccurrenceView[]> {
  if (source === "catalog") return getCatalog();

  const env = publicEnv();
  const client = createSerendipityClient(env.supabaseUrl, env.supabaseAnonKey);
  const rows = await explore(client, {
    lat: query.origin.lat,
    lng: query.origin.lng,
    radius_m: SEARCH_RADIUS_M,
    from_ts: query.from.toISOString(),
    to_ts: new Date(query.to.getTime() + UPCOMING_HORIZON_MS).toISOString(),
    families: query.families ?? null,
  });
  return hydrateOccurrences(rows);
}
