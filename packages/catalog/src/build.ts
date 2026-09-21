import { type PhenomenonInput, type PlaceInput, type RuleRecord } from "@serendipity/domain";
import { materialize } from "@serendipity/domain/server";
import { phenomena, places, rules, sources } from "./data";
import { slugId } from "./ids";
import type { OccurrenceView } from "./types";

const YEARS = [2025, 2026, 2027];

function placeInput(place: (typeof places)[number]): PlaceInput {
  return {
    id: slugId(place.slug),
    timezone: place.timezone,
    latitude: place.lat,
    longitude: place.lng,
    elevationM: place.elevationM,
    hemisphere: place.hemisphere,
  };
}

export function buildOccurrences(): OccurrenceView[] {
  const phenomenonBySlug = new Map(phenomena.map((row) => [row.slug, row]));
  const placeBySlug = new Map(places.map((row) => [row.slug, row]));
  const sourceBySlug = new Map(sources.map((row) => [row.slug, row]));
  const rows: OccurrenceView[] = [];

  for (const rule of rules) {
    const phenomenon = phenomenonBySlug.get(rule.phenomenonSlug);
    const source = sourceBySlug.get(rule.sourceSlug);
    if (!phenomenon || !source) {
      throw new Error(`Broken seed: rule ${rule.slug}`);
    }
    const place = rule.placeSlug ? placeBySlug.get(rule.placeSlug) : undefined;
    if (rule.placeSlug && !place) {
      throw new Error(`Unknown place ${rule.placeSlug} on ${rule.slug}`);
    }

    const record: RuleRecord = {
      id: slugId(rule.slug),
      phenomenonId: slugId(phenomenon.slug),
      placeId: place ? slugId(place.slug) : null,
      scope: rule.scope,
      kind: rule.kind,
      params: rule.params,
      confidence: rule.confidence,
      version: 1,
      active: true,
    };
    const phenomenonInput: PhenomenonInput = {
      id: slugId(phenomenon.slug),
      family: phenomenon.family,
      tags: phenomenon.tags,
    };

    for (const year of YEARS) {
      const drafts = materialize({
        rule: record,
        phenomenon: phenomenonInput,
        place: place ? placeInput(place) : null,
        seasonYear: year,
      });
      for (const draft of drafts) {
        rows.push({
          ...draft,
          phenomenon,
          place: place ?? null,
          rule,
          source,
        });
      }
    }
  }

  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

