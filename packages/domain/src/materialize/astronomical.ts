import { NextMoonQuarter, SearchMoonQuarter, Seasons } from "astronomy-engine";
import type { z } from "zod";
import {
  astronomicalParamsSchema,
  equinoxFilterSchema,
  moonPhaseFilterSchema,
  type MoonPhase,
  type SeasonEvent,
} from "../schemas";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";
import { RuleValidationError, UnsupportedRuleKindError } from "../types";
import { buildOccurrence, instantWindow } from "./build";

const PHASE_NAMES: readonly MoonPhase[] = ["new", "first_quarter", "full", "last_quarter"];

const SEASON_KEYS: Record<SeasonEvent, string> = {
  mar_equinox: "mar-equinox",
  jun_solstice: "jun-solstice",
  sep_equinox: "sep-equinox",
  dec_solstice: "dec-solstice",
};

function seasonEventDate(year: number, event: SeasonEvent): Date {
  const seasons = Seasons(year);
  switch (event) {
    case "mar_equinox":
      return seasons.mar_equinox.date;
    case "jun_solstice":
      return seasons.jun_solstice.date;
    case "sep_equinox":
      return seasons.sep_equinox.date;
    case "dec_solstice":
      return seasons.dec_solstice.date;
  }
}

function parseFilter<T>(schema: z.ZodType<T>, filter: unknown, table: string): T {
  const result = schema.safeParse(filter);
  if (!result.success) {
    throw new RuleValidationError(`invalid astronomical ${table} filter: ${result.error.message}`);
  }
  return result.data;
}

function materializeMoonPhases(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  seasonYear: number,
  rawFilter: unknown,
): OccurrenceDraft[] {
  const filter = parseFilter(moonPhaseFilterSchema.strict(), rawFilter, "moon_phase");
  const wanted = new Set<number>(
    (Array.isArray(filter.phase) ? filter.phase : [filter.phase]).map((name) => PHASE_NAMES.indexOf(name)),
  );
  const months = filter.months ? new Set(filter.months) : null;

  const start = new Date(Date.UTC(seasonYear - 1, 11, 15));
  const end = new Date(Date.UTC(seasonYear + 1, 0, 15));
  let quarter = SearchMoonQuarter(start);
  let instants: { at: Date; phase: MoonPhase }[] = [];

  while (quarter.time.date < end) {
    const at = quarter.time.date;
    if (
      at.getUTCFullYear() === seasonYear &&
      wanted.has(quarter.quarter) &&
      (!months || months.has(at.getUTCMonth() + 1))
    ) {
      instants.push({ at, phase: PHASE_NAMES[quarter.quarter]! });
    }
    quarter = NextMoonQuarter(quarter);
  }

  if (filter.nearestTo && instants.length > 0) {
    const anchor = seasonEventDate(seasonYear, filter.nearestTo).getTime();
    instants = [
      instants.reduce((best, candidate) =>
        Math.abs(candidate.at.getTime() - anchor) < Math.abs(best.at.getTime() - anchor) ? candidate : best,
      ),
    ];
  }

  return instants.map(({ at, phase }) => {
    const { during, peak } = instantWindow(at);
    return buildOccurrence({
      rule,
      phenomenon,
      place: null,
      seasonKey: `${at.toISOString().slice(0, 10)}-${phase}`,
      during,
      peak,
      granularity: "instant",
    });
  });
}

function materializeEquinoxes(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  seasonYear: number,
  rawFilter: unknown,
): OccurrenceDraft[] {
  const filter = parseFilter(equinoxFilterSchema.strict(), rawFilter, "equinox");
  const ordered: SeasonEvent[] = ["mar_equinox", "sep_equinox", "jun_solstice", "dec_solstice"];

  return ordered
    .filter((event) => filter.events.includes(event))
    .map((event) => {
      const { during, peak } = instantWindow(seasonEventDate(seasonYear, event));
      return buildOccurrence({
        rule,
        phenomenon,
        place: null,
        seasonKey: `${seasonYear}-${SEASON_KEYS[event]}`,
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
