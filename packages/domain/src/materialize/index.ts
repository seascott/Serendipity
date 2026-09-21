import { createHash } from "node:crypto";
import { ENGINE_VERSION } from "../constants";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../types";
import { RuleValidationError, UnsupportedRuleKindError } from "../types";
import { materializeAstronomical } from "./astronomical";
import { materializeExplicit } from "./explicit";
import { materializeFixedAnnual } from "./fixed-annual";
import { materializeRrule } from "./rrule";

export type MaterializeInput = {
  rule: RuleRecord;
  phenomenon: PhenomenonInput;
  place?: PlaceInput | null;
  seasonYear: number;
};

export function inputsHash(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function materialize(input: MaterializeInput): OccurrenceDraft[] {
  const { rule, phenomenon, place = null, seasonYear } = input;
  if (!rule.active) return [];
  if (rule.phenomenonId !== phenomenon.id) {
    throw new RuleValidationError("rule.phenomenonId does not match phenomenon.id");
  }
  if (rule.scope === "place" && !place && !rule.placeId) {
    throw new RuleValidationError("place-scoped rules require a place");
  }
  if (place && rule.kind === "seasonal_band") {
    // hemisphere check reserved for the seasonal_band implementation
  }

  switch (rule.kind) {
    case "fixed_annual":
      return materializeFixedAnnual(rule, phenomenon, place, seasonYear);
    case "rrule":
      return materializeRrule(rule, phenomenon, place, seasonYear);
    case "explicit":
      return materializeExplicit(rule, phenomenon, place, seasonYear);
    case "astronomical":
      return materializeAstronomical(rule, phenomenon, place, seasonYear);
    default:
      throw new UnsupportedRuleKindError(rule.kind);
  }
}

export function engineStamp(): { engineVersion: string } {
  return { engineVersion: ENGINE_VERSION };
}
