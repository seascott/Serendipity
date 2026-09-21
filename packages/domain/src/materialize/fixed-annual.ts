import { fixedAnnualParamsSchema } from "../schemas";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";
import { RuleValidationError } from "../types";
import { buildOccurrence, dayWindow } from "./build";
import { addLocalDays, localMidnight, parseMonthDay } from "./civil-time";

export function materializeFixedAnnual(
  rule: RuleRecord,
  phenomenon: PhenomenonInput,
  place: PlaceInput | null,
  seasonYear: number,
): OccurrenceDraft[] {
  const params = fixedAnnualParamsSchema.parse(rule.params);
  const timezone = place?.timezone ?? "UTC";
  const startMd = parseMonthDay(params.startMonthDay);
  const endMd = parseMonthDay(params.endMonthDay);
  const peakMd = params.peakMonthDay ? parseMonthDay(params.peakMonthDay) : null;

  const start = localMidnight(seasonYear, startMd.month, startMd.day, timezone);
  const wraps = endMd.month < startMd.month || (endMd.month === startMd.month && endMd.day < startMd.day);
  const endYear = wraps ? seasonYear + 1 : seasonYear;
  const endInclusive = localMidnight(endYear, endMd.month, endMd.day, timezone);
  const endExclusive = addLocalDays(endInclusive, timezone, 1);

  let peak = null;
  if (peakMd) {
    const peakWraps = peakMd.month < startMd.month || (peakMd.month === startMd.month && peakMd.day < startMd.day);
    const peakYear = peakWraps ? seasonYear + 1 : seasonYear;
    const peakStart = localMidnight(peakYear, peakMd.month, peakMd.day, timezone);
    if (peakStart < start || peakStart >= endExclusive) {
      throw new RuleValidationError("peakMonthDay must fall inside the annual window");
    }
    peak = { start: peakStart, end: addLocalDays(peakStart, timezone, 1) };
  }

  const { during, peak: peakInterval } = dayWindow(start, endExclusive, peak?.start, peak?.end);
  return [
    buildOccurrence({
      rule,
      phenomenon,
      place,
      seasonKey: String(seasonYear),
      during,
      peak: peakInterval,
      granularity: "day",
    }),
  ];
}
