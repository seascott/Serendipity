import { formatWindow, peakProximity, rankScore } from "@serendipity/domain";
import { DateTime } from "luxon";
import { offers } from "./data";
import { confidenceLabel, peakPhrase } from "./labels";
import { estimateTravel, haversineM } from "./travel";
import type { CollectionSeed, OccurrenceView, RankedCard, YearRow } from "./types";

function toInterval(iso: { start: string; end: string }) {
  return { start: new Date(iso.start), end: new Date(iso.end) };
}

function overlaps(during: { start: Date; end: Date }, from: Date, to: Date): boolean {
  return during.start < to && during.end > from;
}

export function groupByPhenomenon(rows: OccurrenceView[]): OccurrenceView[] {
  const grouped = new Map<string, OccurrenceView[]>();
  for (const row of rows) {
    const key = `${row.phenomenon.slug}:${row.place?.slug ?? "global"}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return [...grouped.values()].map((list) => {
    const sorted = [...list].sort((a, b) => a.during.start.localeCompare(b.during.start));
    return sorted[0]!;
  });
}

export function rankOccurrence(
  row: OccurrenceView,
  now: Date,
  origin: { lat: number; lng: number },
  radiusM: number,
  interests: string[],
): Omit<RankedCard, "tier"> {
  const during = toInterval(row.during);
  const peak = row.peak ? toInterval(row.peak) : null;
  const distM = row.place ? haversineM(origin, { lat: row.place.lat, lng: row.place.lng }) : 0;
  const travel = estimateTravel(distM);
  const timezone = row.place?.timezone ?? "UTC";
  return {
    ...row,
    distM,
    travel,
    score: rankScore({
      now,
      peak,
      during,
      confidence: row.confidence,
      distM,
      radiusM,
      tags: row.tags,
      interests,
      spectacle: row.phenomenon.spectacle,
    }),
    peakProx: peakProximity(now, peak, during),
    windowLabel: formatWindow(during, timezone, row.granularity),
    peakLabel: peakPhrase(now, peak, during),
    offers: offers.filter(
      (offer) =>
        offer.phenomenonSlugs.includes(row.phenomenon.slug) &&
        (row.place ? offer.placeSlug === row.place.slug : true),
    ),
  };
}

export function diversityCap(cards: RankedCard[], maxPerFamily = 3): RankedCard[] {
  const counts = new Map<string, number>();
  return cards.filter((card) => {
    const used = counts.get(card.family) ?? 0;
    if (used >= maxPerFamily) return false;
    counts.set(card.family, used + 1);
    return true;
  });
}

export function tierExplore(input: {
  rows: OccurrenceView[];
  now: Date;
  from: Date;
  to: Date;
  origin: { lat: number; lng: number };
  families?: string[] | null;
}): { nearby: RankedCard[]; detour: RankedCard[]; coming: RankedCard[]; sky: RankedCard[] } {
  const interests = input.families ?? [];
  const inFamily = (row: OccurrenceView) =>
    !input.families?.length || input.families.includes(row.family);

  const overlapping = groupByPhenomenon(
    input.rows.filter((row) => {
      if (!inFamily(row)) return false;
      if (row.scope === "global") return false;
      return overlaps(toInterval(row.during), input.from, input.to);
    }),
  );

  const upcoming = groupByPhenomenon(
    input.rows.filter((row) => {
      if (!inFamily(row) || row.scope === "global") return false;
      const during = toInterval(row.during);
      const horizon = new Date(input.to.getTime() + 90 * 86_400_000);
      return during.start >= input.to && during.start < horizon;
    }),
  );

  const skySource = input.rows.filter((row) => {
    if (row.scope !== "global") return false;
    return overlaps(toInterval(row.during), input.from, input.to);
  });

  const toCards = (rows: OccurrenceView[], radiusM: number, tier: RankedCard["tier"]) =>
    diversityCap(
      rows
        .map((row) => ({ ...rankOccurrence(row, input.now, input.origin, radiusM, interests), tier }))
        .sort((a, b) => b.score - a.score),
    );

  const nearby = toCards(
    overlapping.filter((row) => {
      if (!row.place) return false;
      return haversineM(input.origin, { lat: row.place.lat, lng: row.place.lng }) <= 150_000;
    }),
    150_000,
    1,
  );

  const detour = toCards(
    overlapping.filter((row) => {
      if (!row.place) return false;
      const dist = haversineM(input.origin, { lat: row.place.lat, lng: row.place.lng });
      return dist > 150_000 && dist <= 450_000;
    }),
    450_000,
    2,
  );

  const coming = toCards(
    upcoming.filter((row) => {
      if (!row.place) return false;
      return haversineM(input.origin, { lat: row.place.lat, lng: row.place.lng }) <= 700_000;
    }),
    700_000,
    3,
  );

  const sky = skySource
    .map((row) => ({ ...rankOccurrence(row, input.now, input.origin, 1, interests), tier: 0 as const }))
    .sort((a, b) => a.during.start.localeCompare(b.during.start))
    .slice(0, 2);

  return { nearby, detour, coming, sky };
}

export function yearBands(rows: OccurrenceView[], collection: CollectionSeed, year: number): YearRow[] {
  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: "utc" });
  const end = start.plus({ years: 1 });
  return collection.phenomenonSlugs.flatMap((slug) => {
    const matches = rows.filter((row) => {
      if (row.phenomenon.slug !== slug) return false;
      const during = toInterval(row.during);
      return during.start < end.toJSDate() && during.end > start.toJSDate();
    });
    if (matches.length === 0) return [];
    const first = matches[0]!;
    return [
      {
        phenomenon: first.phenomenon,
        place: first.place,
        windows: matches.map((row) => ({
          start: new Date(row.during.start),
          end: new Date(row.during.end),
          peak: row.peak ? { start: new Date(row.peak.start), end: new Date(row.peak.end) } : null,
        })),
      },
    ];
  });
}

export function nextOccurrences(rows: OccurrenceView[], slug: string, now: Date, limit = 3): OccurrenceView[] {
  return rows
    .filter((row) => row.phenomenon.slug === slug && new Date(row.during.end) > now)
    .sort((a, b) => a.during.start.localeCompare(b.during.start))
    .slice(0, limit);
}

export function happeningSoon(rows: OccurrenceView[], now: Date, days = 30, limit = 5): RankedCard[] {
  const to = new Date(now.getTime() + days * 86_400_000);
  return rows
    .filter((row) => row.scope !== "global" && overlaps(toInterval(row.during), now, to))
    .map((row) => ({
      ...rankOccurrence(row, now, { lat: 41.9, lng: 12.5 }, 2_000_000, []),
      tier: 1 as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export { confidenceLabel };
