import type { Family, OccurrenceDraft, OccurrenceScope, RuleKind } from "@serendipity/domain";

export type SceneTexture = "sky" | "water" | "canopy" | "ridge" | "field" | "vine";

export type Scene = {
  palette: [string, string, string];
  texture: SceneTexture;
};

export type PhenomenonSeed = {
  slug: string;
  name: string;
  family: Family;
  tags: string[];
  spectacle: 1 | 2 | 3 | 4 | 5;
  summary: string;
  description: string;
  howToSee: string;
  ethics?: string;
  practical?: {
    needsBoat?: boolean;
    needsDarkSky?: boolean;
    permit?: string;
    guideRecommended?: boolean;
  };
  sourceSlugs: string[];
  scene: Scene;
};

export type PlaceSeed = {
  slug: string;
  name: string;
  kind: "point" | "park" | "city" | "region" | "country";
  lat: number;
  lng: number;
  timezone: string;
  countryCode: string;
  parentSlug?: string;
  elevationM?: number;
  hemisphere: "N" | "S";
  blurb: string;
  scene: Scene;
};

export type RuleSeed = {
  slug: string;
  phenomenonSlug: string;
  placeSlug: string | null;
  scope: OccurrenceScope;
  kind: Extract<RuleKind, "fixed_annual" | "rrule" | "explicit" | "astronomical">;
  params: unknown;
  confidence: number;
  sourceSlug: string;
  note?: string;
};

export type SourceSeed = {
  slug: string;
  title: string;
  publisher: string;
  url: string;
  lastVerified: string;
};

export type OfferSeed = {
  id: string;
  providerId: "viator" | "gyg" | "booking";
  supplierName: string;
  title: string;
  kind: "tour" | "activity" | "stay";
  placeSlug: string;
  phenomenonSlugs: string[];
  priceFromMinor: number;
  currency: string;
  priceAsOf: string;
  rating: number;
  reviewCount: number;
  durationMinutes: number;
  cancellation: string;
};

export type CollectionSeed = {
  slug: string;
  title: string;
  kicker: string;
  intro: string;
  phenomenonSlugs: string[];
  defaultYear: number;
};

export type PairSeed = {
  slug: string;
  phenomenonSlug: string;
  placeSlug: string;
  intro: string;
};

export type OccurrenceView = OccurrenceDraft & {
  phenomenon: PhenomenonSeed;
  place: PlaceSeed | null;
  rule: RuleSeed;
  source: SourceSeed;
};

export type RankedCard = OccurrenceView & {
  distM: number;
  travel: { minutes: number; mode: "drive" | "rail" | "fly" };
  score: number;
  peakProx: number;
  tier: 1 | 2 | 3 | 0;
  windowLabel: string;
  peakLabel: string;
  offers: OfferSeed[];
};

export type YearRow = {
  phenomenon: PhenomenonSeed;
  place: PlaceSeed | null;
  windows: { start: Date; end: Date; peak: { start: Date; end: Date } | null }[];
};
