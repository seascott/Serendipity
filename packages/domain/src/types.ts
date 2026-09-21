import { ENGINE_VERSION, type FAMILIES, type OCCURRENCE_SCOPES, type RULE_KINDS } from "./constants";

export type Family = (typeof FAMILIES)[number];
export type OccurrenceScope = (typeof OCCURRENCE_SCOPES)[number];
export type RuleKind = (typeof RULE_KINDS)[number];
export type Granularity = "day" | "instant";
export type PublishStatus = "draft" | "published" | "archived";
export type Hemisphere = "N" | "S";

export type Interval = {
  start: Date;
  end: Date;
};

export type IsoInterval = {
  start: string;
  end: string;
};

export type RankWeights = {
  peakProximity: number;
  travelBand: number;
  confidence: number;
  interest: number;
  spectacle: number;
};

export type PlaceInput = {
  id: string;
  timezone: string;
  latitude: number;
  longitude: number;
  elevationM?: number;
  hemisphere: Hemisphere;
};

export type PhenomenonInput = {
  id: string;
  family: Family;
  tags: string[];
  status?: PublishStatus;
};

export type RuleRecord = {
  id: string;
  phenomenonId: string;
  placeId: string | null;
  scope: OccurrenceScope;
  kind: RuleKind;
  params: unknown;
  confidence: number;
  version: number;
  active: boolean;
};

export type OccurrenceDraft = {
  id: string;
  ruleId: string;
  phenomenonId: string;
  placeId: string | null;
  scope: OccurrenceScope;
  seasonKey: string;
  family: Family;
  tags: string[];
  during: IsoInterval;
  peak: IsoInterval | null;
  granularity: Granularity;
  confidence: number;
  geom: { type: "Point"; coordinates: [number, number] } | null;
  status: PublishStatus;
  ruleVersion: number;
  engineVersion: string;
};

export class UnsupportedRuleKindError extends Error {
  readonly kind: RuleKind;

  constructor(kind: RuleKind) {
    super(`Rule kind "${kind}" is not implemented in engine ${ENGINE_VERSION}`);
    this.name = "UnsupportedRuleKindError";
    this.kind = kind;
  }
}

export class RuleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleValidationError";
  }
}
