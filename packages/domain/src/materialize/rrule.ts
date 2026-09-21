import { type RRule, rrulestr } from "rrule";
import { rruleParamsSchema } from "../schemas";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";
import { RuleValidationError } from "../types";
import { buildOccurrence, dayWindow } from "./build";
import { addLocalDays, isoDateOf, localMidnight } from "./civil-time";

/**
 * `rrule` is timezone-naive: it iterates civil dates on the UTC clock. We feed it
 * floating dates (UTC midnight = civil midnight) and re-anchor each result to the
 * place's local midnight, so BYDAY/BYMONTH are evaluated on the civil calendar.
 */
export function materializeRrule(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  place: PlaceInput | null,
  seasonYear: number,
): OccurrenceDraft[] {
  const params = rruleParamsSchema.parse(rule.params);
  const timezone = place?.timezone ?? "UTC";
  const floatingYearStart = new Date(Date.UTC(seasonYear, 0, 1));
  const floatingYearEnd = new Date(Date.UTC(seasonYear + 1, 0, 1));

  let parsed: RRule;
  try {
    parsed = rrulestr(params.rrule.includes("RRULE:") ? params.rrule : `RRULE:${params.rrule}`, {
      dtstart: floatingYearStart,
    });
  } catch (error) {
    throw new RuleValidationError(`Invalid rrule: ${error instanceof Error ? error.message : String(error)}`);
  }

  const floating = parsed
    .between(floatingYearStart, floatingYearEnd, true)
    .filter((date) => date < floatingYearEnd);

  return floating.map((civil) => {
    const start = localMidnight(civil.getUTCFullYear(), civil.getUTCMonth() + 1, civil.getUTCDate(), timezone);
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
