import { NextMoonQuarter, SearchMoonQuarter, Seasons } from "astronomy-engine";
import { astronomicalParamsSchema } from "../schemas";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";
import { RuleValidationError, UnsupportedRuleKindError } from "../types";
import { buildOccurrence, instantWindow } from "./build";

const PHASE_NAMES = ["new", "first_quarter", "full", "last_quarter"] as const;

function wantedPhases(filter: Record<string, unknown>): Set<number> {
  const raw = filter.phase ?? filter.phases;
  if (raw == null) return new Set([0, 1, 2, 3]);
  const values = Array.isArray(raw) ? raw : [raw];
  const wanted = new Set<number>();
  for (const value of values) {
    if (typeof value === "number" && value >= 0 && value <= 3) {
      wanted.add(value);
      continue;
    }
    if (typeof value === "string") {
      const idx = PHASE_NAMES.indexOf(value as (typeof PHASE_NAMES)[number]);
      if (idx >= 0) wanted.add(idx);
    }
  }
  if (wanted.size === 0) {
    throw new RuleValidationError("astronomical moon_phase filter matched no phases");
  }
  return wanted;
}

function materializeMoonPhases(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  seasonYear: number,
  filter: Record<string, unknown>,
): OccurrenceDraft[] {
  const wanted = wantedPhases(filter);
  const start = new Date(Date.UTC(seasonYear - 1, 11, 15));
  const end = new Date(Date.UTC(seasonYear + 1, 0, 15));
  let quarter = SearchMoonQuarter(start);
  const rows: OccurrenceDraft[] = [];

  while (quarter.time.date < end) {
    const at = quarter.time.date;
    if (at.getUTCFullYear() === seasonYear && wanted.has(quarter.quarter)) {
      const { during, peak } = instantWindow(at);
      const seasonKey = at.toISOString().slice(0, 10);
      rows.push(
        buildOccurrence({
          rule,
          phenomenon,
          place: null,
          seasonKey: `${seasonKey}-${PHASE_NAMES[quarter.quarter]}`,
          during,
          peak,
          granularity: "instant",
        }),
      );
    }
    quarter = NextMoonQuarter(quarter);
  }
  return rows;
}

function materializeEquinoxes(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  seasonYear: number,
  filter: Record<string, unknown>,
): OccurrenceDraft[] {
  const includeSolstice = filter.solstice !== false && filter.events !== "equinox_only";
  const seasons = Seasons(seasonYear);
  const events: { key: string; at: Date }[] = [
    { key: "mar-equinox", at: seasons.mar_equinox.date },
    { key: "sep-equinox", at: seasons.sep_equinox.date },
  ];
  if (includeSolstice) {
    events.push(
      { key: "jun-solstice", at: seasons.jun_solstice.date },
      { key: "dec-solstice", at: seasons.dec_solstice.date },
    );
  }

  return events.map((event) => {
    const { during, peak } = instantWindow(event.at);
    return buildOccurrence({
      rule,
      phenomenon,
      place: null,
      seasonKey: `${seasonYear}-${event.key}`,
      during,
      peak,
      granularity: "instant",
    });
  });
}

export function materializeAstronomical(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  place: PlaceInput | null,
  seasonYear: number,
): OccurrenceDraft[] {
  const params = astronomicalParamsSchema.parse(rule.params);
  if (params.table !== "moon_phase" && params.table !== "equinox") {
    throw new UnsupportedRuleKindError("astronomical");
  }
  if (rule.scope !== "global") {
    throw new RuleValidationError("P0 astronomical materialize only emits global-scope rows");
  }
  if (place) {
    throw new RuleValidationError("global astronomical rules must not be bound to a place");
  }

  if (params.table === "moon_phase") {
    return materializeMoonPhases(rule, phenomenon, seasonYear, params.filter);
  }
  return materializeEquinoxes(rule, phenomenon, seasonYear, params.filter);
}
