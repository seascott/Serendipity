import { ENGINE_VERSION } from "../constants";
import { occurrenceId } from "../ids";
import { toIso } from "../format";
import type { Granularity, Interval, OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";

export function buildOccurrence(input: {
  rule: RuleRecord;
  phenomenon: PhenomenonInput;
  place?: PlaceInput | null;
  seasonKey: string;
  during: Interval;
  peak?: Interval | null;
  granularity: Granularity;
}): OccurrenceDraft {
  const placeId = input.place?.id ?? input.rule.placeId;
  const geom =
    input.rule.scope === "place" && input.place
      ? { type: "Point" as const, coordinates: [input.place.longitude, input.place.latitude] as [number, number] }
      : null;

  return {
    id: occurrenceId(input.rule.id, input.seasonKey, placeId),
    ruleId: input.rule.id,
    phenomenonId: input.phenomenon.id,
    placeId,
    scope: input.rule.scope,
    seasonKey: input.seasonKey,
    family: input.phenomenon.family,
    tags: input.phenomenon.tags,
    during: { start: toIso(input.during.start), end: toIso(input.during.end) },
    peak: input.peak
      ? { start: toIso(input.peak.start), end: toIso(input.peak.end) }
      : null,
    granularity: input.granularity,
    confidence: input.rule.confidence,
    geom,
    status: input.phenomenon.status ?? "published",
    ruleVersion: input.rule.version,
    engineVersion: ENGINE_VERSION,
  };
}

export function dayWindow(start: Date, endExclusive: Date, peakStart?: Date, peakEndExclusive?: Date): {
  during: Interval;
  peak: Interval | null;
} {
  return {
    during: { start, end: endExclusive },
    peak:
      peakStart && peakEndExclusive
        ? { start: peakStart, end: peakEndExclusive }
        : null,
  };
}

export function instantWindow(at: Date): { during: Interval; peak: Interval } {
  const end = new Date(at.getTime() + 1000);
  return {
    during: { start: at, end },
    peak: { start: at, end },
  };
}
