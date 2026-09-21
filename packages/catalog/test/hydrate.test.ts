import { describe, expect, it } from "vitest";
import { hydrateOccurrences, type OccurrenceRecord } from "../src/hydrate";
import { getCatalog } from "../src/server";
import type { OccurrenceView } from "../src/types";

/** Shapes an in-memory row the way the `explore()` RPC returns it. */
function toRecord(row: OccurrenceView): OccurrenceRecord {
  return {
    id: row.id,
    rule_id: row.ruleId,
    phenomenon_id: row.phenomenonId,
    place_id: row.placeId,
    scope: row.scope,
    season_key: row.seasonKey,
    family: row.family,
    tags: row.tags,
    starts_at: row.during.start,
    ends_at: row.during.end,
    peak_starts_at: row.peak?.start ?? null,
    peak_ends_at: row.peak?.end ?? null,
    granularity: row.granularity,
    confidence: row.confidence,
    lat: row.geom?.coordinates[1] ?? null,
    lng: row.geom?.coordinates[0] ?? null,
  };
}

describe("hydrateOccurrences", () => {
  it("round-trips every catalog occurrence through the RPC row shape", () => {
    const catalog = getCatalog();
    const hydrated = hydrateOccurrences(catalog.map(toRecord));
    expect(hydrated).toHaveLength(catalog.length);
    for (const [index, view] of hydrated.entries()) {
      const original = catalog[index]!;
      expect(view.id).toBe(original.id);
      expect(view.phenomenon).toBe(original.phenomenon);
      expect(view.place).toBe(original.place);
      expect(view.rule).toBe(original.rule);
      expect(view.source).toBe(original.source);
      expect(view.during).toEqual(original.during);
      expect(view.peak).toEqual(original.peak);
      expect(view.geom).toEqual(original.geom);
    }
  });

  it("drops rows the current catalog build does not know", () => {
    const [first] = getCatalog();
    const unknownRule = { ...toRecord(first!), rule_id: "00000000-0000-4000-8000-000000000000" };
    const unknownPlace = { ...toRecord(first!), place_id: "00000000-0000-4000-8000-000000000001" };
    expect(hydrateOccurrences([unknownRule, unknownPlace])).toEqual([]);
  });
});
