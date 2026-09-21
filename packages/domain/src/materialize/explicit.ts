import { DateTime } from "luxon";
import { explicitParamsSchema } from "../schemas";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";
import { RuleValidationError } from "../types";
import { buildOccurrence, dayWindow } from "./build";
import { addLocalDays, parseCivilOrInstant } from "./civil-time";

function seasonYearOf(seasonKey: string): number | null {
  const match = /^(\d{4})/.exec(seasonKey);
  return match ? Number(match[1]) : null;
}

export function materializeExplicit(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  place: PlaceInput | null,
  seasonYear: number,
): OccurrenceDraft[] {
  const params = explicitParamsSchema.parse(rule.params);
  const timezone = place?.timezone ?? "UTC";

  return params.windows
    .filter((window) => seasonYearOf(window.seasonKey) === seasonYear)
    .map((window) => {
      const start = parseCivilOrInstant(window.start, timezone);
      const endParsed = parseCivilOrInstant(window.end, timezone);
      const endLooksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(window.end);
      const endExclusive = endLooksLikeDate ? addLocalDays(endParsed, timezone, 1) : endParsed;
      if (endExclusive <= start) {
        throw new RuleValidationError(`explicit window ${window.seasonKey} has end <= start`);
      }

      let peakStart: Date | undefined;
      let peakEnd: Date | undefined;
      if (window.peak) {
        peakStart = parseCivilOrInstant(window.peak[0], timezone);
        const peakEndParsed = parseCivilOrInstant(window.peak[1], timezone);
        const peakEndLooksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(window.peak[1]);
        peakEnd = peakEndLooksLikeDate ? addLocalDays(peakEndParsed, timezone, 1) : peakEndParsed;
        if (peakStart < start || peakEnd > endExclusive) {
          throw new RuleValidationError(`explicit peak for ${window.seasonKey} is outside during`);
        }
      }

      const { during, peak } = dayWindow(start, endExclusive, peakStart, peakEnd);
      const granularity = DateTime.fromJSDate(endExclusive).diff(DateTime.fromJSDate(start), "hours").hours < 24
        && !endLooksLikeDate
        ? "instant"
        : "day";

      return buildOccurrence({
        rule,
        phenomenon,
        place,
        seasonKey: window.seasonKey,
        during,
        peak,
        granularity,
      });
    });
}
