/** Bump when materialize() output changes in a non-identical way. Golden tests fail if you forget. */
export const ENGINE_VERSION = "0.1.0";

/** DNS namespace used for deterministic occurrence ids (uuid v5). */
export const OCCURRENCE_NAMESPACE = "a1f3c8e0-5e2b-4d7a-9c11-8b0e4f2a6d19";

export const FAMILIES = [
  "wildlife",
  "astronomy",
  "cultural",
  "seasonal_nature",
  "activity",
] as const;

export const OCCURRENCE_SCOPES = ["place", "area", "global"] as const;

export const RULE_KINDS = [
  "fixed_annual",
  "rrule",
  "seasonal_band",
  "lunar",
  "astronomical",
  "explicit",
  "cadence",
  "override",
] as const;

/** P0 engine implements these kinds. Others throw UnsupportedRuleKindError. */
export const P0_RULE_KINDS = ["fixed_annual", "rrule", "explicit", "astronomical"] as const;

export const TABLES = {
  place: "place",
  phenomenon: "phenomenon",
  phenomenonPlace: "phenomenon_place",
  source: "source",
  phenomenonSource: "phenomenon_source",
  rule: "rule",
  ruleMaterialization: "rule_materialization",
  occurrence: "occurrence",
  landingPage: "landing_page",
  slugRedirect: "slug_redirect",
  provider: "provider",
  supplier: "supplier",
  placeExternalRef: "place_external_ref",
  bookingOffer: "booking_offer",
  offerPhenomenon: "offer_phenomenon",
  offerAvailability: "offer_availability",
  affiliateClick: "affiliate_click",
  conversion: "conversion",
  booking: "booking",
  fxRate: "fx_rate",
  profile: "profile",
  device: "device",
  trip: "trip",
  tripLeg: "trip_leg",
  tripItem: "trip_item",
  save: "save",
  alert: "alert",
  contribution: "contribution",
  report: "report",
  config: "config",
  event: "event",
} as const;

export const RPC = {
  explore: "explore",
  plan: "plan",
  mapCells: "map_cells",
  getSharedTrip: "get_shared_trip",
} as const;

export const DEFAULT_RANK_WEIGHTS = {
  peakProximity: 0.35,
  travelBand: 0.25,
  confidence: 0.2,
  interest: 0.1,
  spectacle: 0.1,
} as const;

export const DETOUR_FACTOR = 1.4;
export const INTEREST_MATCH_CAP = 3;
export const MS_PER_DAY = 86_400_000;
