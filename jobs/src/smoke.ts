import { createSerendipityClient, explore, type ExploreRow, type SerendipityClient } from "@serendipity/api/core";
import { DEMO_NOW, ITALY_WINDOW, places } from "@serendipity/catalog";
import { getCatalog } from "@serendipity/catalog/server";
import { rankScore } from "@serendipity/domain";
import { RANK_VECTORS } from "@serendipity/domain/server";

/**
 * End-to-end smoke against a running Supabase (local or CI) that has loaded
 * supabase/seed/catalog.sql: the anon `explore()` RPC must return the seeded
 * rows and rank them exactly as the TypeScript ranker does.
 *
 *   eval "$(supabase status -o env)" && pnpm --filter @serendipity/jobs smoke
 */

const TOLERANCE = 1e-6;
const RADIUS_M = 300_000;

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`missing env: one of ${names.join(", ")}`);
}

function tstzrange(interval: { start: string; end: string } | null): string | null {
  return interval ? `[${interval.start},${interval.end})` : null;
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`smoke failed: ${message}`);
  console.log(`ok - ${message}`);
}

async function rankVectorParity(client: SerendipityClient): Promise<void> {
  for (const vector of RANK_VECTORS) {
    const { data, error } = await client.rpc("rank_score", {
      during: tstzrange(vector.during)!,
      peak: tstzrange(vector.peak),
      confidence: vector.confidence,
      dist_m: vector.distM,
      radius_m: vector.radiusM,
      now_ts: vector.now,
      tags: vector.tags,
      interests: vector.interests,
      spectacle: vector.spectacle,
    });
    if (error) throw error;
    check(
      typeof data === "number" && Math.abs(data - vector.expected) < TOLERANCE,
      `sql rank_score matches TS for "${vector.name}" (${data} vs ${vector.expected})`,
    );
  }
}

function tsScoreFor(row: ExploreRow, from: Date, spectacle: number): number {
  return rankScore({
    now: from,
    during: { start: new Date(row.starts_at), end: new Date(row.ends_at) },
    peak: row.peak_starts_at && row.peak_ends_at ? { start: new Date(row.peak_starts_at), end: new Date(row.peak_ends_at) } : null,
    confidence: Number(row.confidence),
    distM: row.dist_m,
    radiusM: RADIUS_M,
    tags: row.tags,
    interests: null,
    spectacle,
  });
}

async function exploreSmoke(client: SerendipityClient): Promise<void> {
  const florence = places.find((place) => place.slug === "florence");
  if (!florence) throw new Error("catalog has no florence");
  const catalog = new Map(getCatalog().map((row) => [row.id, row]));

  const rows = await explore(client, {
    lat: florence.lat,
    lng: florence.lng,
    radius_m: RADIUS_M,
    from_ts: ITALY_WINDOW.from.toISOString(),
    to_ts: ITALY_WINDOW.to.toISOString(),
  });

  check(rows.length >= 5, `explore() from Florence returns ${rows.length} rows for the Italy fortnight`);
  check(
    rows.every((row) => catalog.has(row.id)),
    "every RPC row is a catalog occurrence (deterministic uuid v5 ids agree)",
  );
  check(
    rows.every((row) => row.phenomenon_name === catalog.get(row.id)?.phenomenon.name),
    "phenomenon names come from published rows",
  );
  check(
    rows.some((row) => row.scope === "global" && row.season_key === "2026-09-26-full"),
    "the 2026 Harvest Moon global row is in the window",
  );
  check(
    rows.some((row) => row.scope !== "global" && row.dist_m > 0 && row.lat !== null),
    "place-scoped rows carry distance and coordinates",
  );

  const drift = rows
    .map((row) => {
      const expected = tsScoreFor(row, ITALY_WINDOW.from, catalog.get(row.id)!.phenomenon.spectacle);
      return { row, expected, delta: Math.abs(expected - row.score) };
    })
    .filter(({ delta }) => delta > TOLERANCE);
  for (const { row, expected } of drift) {
    console.error(`  drift ${row.season_key} ${row.phenomenon_name}: sql=${row.score} ts=${expected}`);
  }
  check(drift.length === 0, `sql score == ts rankScore for all ${rows.length} explore rows`);
  check(
    rows.every((row, i) => i === 0 || rows[i - 1]!.score >= row.score),
    "rows are ordered by score desc",
  );
  console.log(`demo now: ${DEMO_NOW.toISOString()}; top: ${rows[0]?.phenomenon_name} (${rows[0]?.score.toFixed(4)})`);
}

async function main(): Promise<void> {
  const client = createSerendipityClient(
    env("SUPABASE_URL", "API_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_ANON_KEY", "ANON_KEY", "PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
  await rankVectorParity(client);
  await exploreSmoke(client);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
