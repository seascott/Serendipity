import { ENGINE_VERSION, type Family, type OccurrenceScope } from "@serendipity/domain";
import { phenomena, places, rules, sources } from "./data";
import { slugId } from "./ids";
import type { OccurrenceView } from "./types";

/**
 * Shape of a materialized occurrence as returned by the `explore()` RPC.
 * Structural on purpose so the catalog never depends on the API package.
 */
export type OccurrenceRecord = {
  id: string;
  rule_id: string;
  phenomenon_id: string;
  place_id: string | null;
  scope: OccurrenceScope;
  season_key: string;
  family: Family;
  tags: string[];
  starts_at: string;
  ends_at: string;
  peak_starts_at: string | null;
  peak_ends_at: string | null;
  granularity: "day" | "instant";
  confidence: number;
  lat: number | null;
  lng: number | null;
};

const phenomenonById = new Map(phenomena.map((row) => [slugId(row.slug), row]));
const placeById = new Map(places.map((row) => [slugId(row.slug), row]));
const ruleById = new Map(rules.map((row) => [slugId(row.slug), row]));
const sourceBySlug = new Map(sources.map((row) => [row.slug, row]));

/**
 * Joins database occurrence rows back onto the editorial catalog (names, copy,
 * scenes, offers) by deterministic id. Rows whose rule/phenomenon are unknown to
 * this build of the catalog are dropped rather than rendered half-empty.
 */
export function hydrateOccurrences(records: readonly OccurrenceRecord[]): OccurrenceView[] {
  const views: OccurrenceView[] = [];
  for (const record of records) {
    const phenomenon = phenomenonById.get(record.phenomenon_id);
    const rule = ruleById.get(record.rule_id);
    const source = rule ? sourceBySlug.get(rule.sourceSlug) : undefined;
    if (!phenomenon || !rule || !source) continue;
    const place = record.place_id ? placeById.get(record.place_id) : undefined;
    if (record.place_id && !place) continue;

    views.push({
      id: record.id,
      ruleId: record.rule_id,
      phenomenonId: record.phenomenon_id,
      placeId: record.place_id,
      scope: record.scope,
      seasonKey: record.season_key,
      family: record.family,
      tags: record.tags,
      during: { start: record.starts_at, end: record.ends_at },
      peak:
        record.peak_starts_at && record.peak_ends_at
          ? { start: record.peak_starts_at, end: record.peak_ends_at }
          : null,
      granularity: record.granularity,
      confidence: record.confidence,
      geom:
        record.lat !== null && record.lng !== null
          ? { type: "Point", coordinates: [record.lng, record.lat] }
          : null,
      status: "published",
      ruleVersion: 1,
      engineVersion: ENGINE_VERSION,
      phenomenon,
      place: place ?? null,
      rule,
      source,
    });
  }
  return views;
}
