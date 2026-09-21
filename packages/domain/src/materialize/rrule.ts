import { DateTime } from "luxon";
import { type RRule, rrulestr } from "rrule";
import { rruleParamsSchema } from "../schemas";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";
import { RuleValidationError } from "../types";
import { buildOccurrence, dayWindow } from "./build";
import { addLocalDays, isoDateOf } from "./civil-time";

export function materializeRrule(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  place: PlaceInput | null,
  seasonYear: number,
): OccurrenceDraft[] {
  const params = rruleParamsSchema.parse(rule.params);
  const timezone = place?.timezone ?? "UTC";
  const yearStart = DateTime.fromObject({ year: seasonYear, month: 1, day: 1 }, { zone: timezone });
  const yearEnd = yearStart.plus({ years: 1 });
  if (!yearStart.isValid || !yearEnd.isValid) {
    throw new RuleValidationError(`Invalid timezone "${timezone}"`);
  }

  let parsed: RRule;
  try {
    parsed = rrulestr(params.rrule.includes("RRULE:") ? params.rrule : `RRULE:${params.rrule}`, {
      dtstart: yearStart.toJSDate(),
    });
  } catch (error) {
    throw new RuleValidationError(`Invalid rrule: ${error instanceof Error ? error.message : String(error)}`);
  }

  const dates = parsed.between(yearStart.toJSDate(), yearEnd.toJSDate(), true);
  return dates.map((raw) => {
    const start = DateTime.fromJSDate(raw, { zone: "utc" }).setZone(timezone).startOf("day").toJSDate();
    const endExclusive = addLocalDays(start, timezone, params.durationDays);
    const { during, peak } = dayWindow(start, endExclusive);
    return buildOccurrence({
      rule,
      phenomenon,
      place,
      seasonKey: isoDateOf(start, timezone),
      during,
      peak,
      granularity: "day",
    });
  });
}
