import { z } from "zod";
import { FAMILIES, OCCURRENCE_SCOPES, RULE_KINDS } from "./constants";

export const familySchema = z.enum(FAMILIES);
export const occurrenceScopeSchema = z.enum(OCCURRENCE_SCOPES);
export const ruleKindSchema = z.enum(RULE_KINDS);
export const monthDaySchema = z.string().regex(/^\d{2}-\d{2}$/, "expected MM-DD");

export const fixedAnnualParamsSchema = z.object({
  startMonthDay: monthDaySchema,
  endMonthDay: monthDaySchema,
  peakMonthDay: monthDaySchema.optional(),
});

export const rruleParamsSchema = z.object({
  rrule: z.string().min(1),
  durationDays: z.number().int().positive(),
});

export const explicitWindowSchema = z.object({
  seasonKey: z.string().min(1),
  start: z.string().min(1),
  peak: z.tuple([z.string(), z.string()]).optional(),
  end: z.string().min(1),
});

export const explicitParamsSchema = z.object({
  windows: z.array(explicitWindowSchema).min(1),
});

export const astronomicalTableSchema = z.enum([
  "eclipse",
  "meteor",
  "moon_phase",
  "equinox",
  "tide",
  "aurora_season",
]);

export const astronomicalParamsSchema = z.object({
  table: astronomicalTableSchema,
  filter: z.record(z.string(), z.unknown()).default({}),
});

export const seasonEventSchema = z.enum(["mar_equinox", "jun_solstice", "sep_equinox", "dec_solstice"]);

export const moonPhaseSchema = z.enum(["new", "first_quarter", "full", "last_quarter"]);

/** `equinox` table filter: pick the season events to emit (default: all four). */
export const equinoxFilterSchema = z.object({
  events: z.array(seasonEventSchema).min(1).default(["mar_equinox", "jun_solstice", "sep_equinox", "dec_solstice"]),
});

/**
 * `moon_phase` table filter. `months` restricts to civil UTC months; `nearestTo`
 * keeps only the single phase instant closest to a season event (e.g. the Harvest
 * Moon is the full moon nearest the September equinox).
 */
export const moonPhaseFilterSchema = z.object({
  phase: z.union([moonPhaseSchema, z.array(moonPhaseSchema).min(1)]).default(["new", "first_quarter", "full", "last_quarter"]),
  months: z.array(z.number().int().min(1).max(12)).min(1).optional(),
  nearestTo: seasonEventSchema.optional(),
});

export const seasonalBandParamsSchema = z.object({
  peakDoy: z.number().int().min(1).max(366),
  halfWidthDays: z.number().positive(),
  peakSigmaDays: z.number().nonnegative(),
  hemisphere: z.enum(["N", "S"]),
  gradient: z
    .object({
      anchor: z.object({ lat: z.number(), elevM: z.number() }),
      daysPerDegLat: z.number(),
      daysPer100mElev: z.number(),
    })
    .optional(),
  driver: z
    .enum(["photoperiod", "temperature", "snowmelt", "rainfall", "sst", "unknown"])
    .optional(),
});

export const lunarParamsSchema = z.object({
  calendar: z.enum([
    "hebrew",
    "easter_western",
    "easter_orthodox",
    "chinese",
    "hijri_umm_al_qura",
  ]),
  offsetDays: z.number().int(),
  durationDays: z.number().int().positive(),
});

export const cadenceParamsSchema = z.object({
  everyNYears: z.number().int().positive(),
  anchorYear: z.number().int(),
  startMonthDay: monthDaySchema,
  endMonthDay: monthDaySchema,
});

export const overrideParamsSchema = z.object({
  placeId: z.string().uuid(),
  seasonKey: z.string().min(1),
  start: z.string().min(1),
  peak: z.tuple([z.string(), z.string()]).optional(),
  end: z.string().min(1),
  reason: z.string().min(1),
});

export const ruleParamsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed_annual"), ...fixedAnnualParamsSchema.shape }),
  z.object({ kind: z.literal("rrule"), ...rruleParamsSchema.shape }),
  z.object({ kind: z.literal("explicit"), ...explicitParamsSchema.shape }),
  z.object({ kind: z.literal("astronomical"), ...astronomicalParamsSchema.shape }),
  z.object({ kind: z.literal("seasonal_band"), ...seasonalBandParamsSchema.shape }),
  z.object({ kind: z.literal("lunar"), ...lunarParamsSchema.shape }),
  z.object({ kind: z.literal("cadence"), ...cadenceParamsSchema.shape }),
  z.object({ kind: z.literal("override"), ...overrideParamsSchema.shape }),
]);

export const ruleRecordSchema = z.object({
  id: z.string().uuid(),
  phenomenonId: z.string().uuid(),
  placeId: z.string().uuid().nullable(),
  scope: occurrenceScopeSchema,
  kind: ruleKindSchema,
  params: z.unknown(),
  confidence: z.number().min(0).max(1),
  version: z.number().int().positive(),
  active: z.boolean(),
});

export type FixedAnnualParams = z.infer<typeof fixedAnnualParamsSchema>;
export type RRuleParams = z.infer<typeof rruleParamsSchema>;
export type ExplicitParams = z.infer<typeof explicitParamsSchema>;
export type AstronomicalParams = z.infer<typeof astronomicalParamsSchema>;
export type SeasonEvent = z.infer<typeof seasonEventSchema>;
export type MoonPhase = z.infer<typeof moonPhaseSchema>;
export type EquinoxFilter = z.infer<typeof equinoxFilterSchema>;
export type MoonPhaseFilter = z.infer<typeof moonPhaseFilterSchema>;
