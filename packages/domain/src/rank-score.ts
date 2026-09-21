import { DEFAULT_RANK_WEIGHTS, DETOUR_FACTOR, INTEREST_MATCH_CAP } from "./constants";
import { peakProximity } from "./peak-proximity";
import type { Interval, RankWeights } from "./types";

export function travelBand(distM: number, radiusM: number): number {
  if (radiusM <= 0) return 0;
  const effective = distM * DETOUR_FACTOR;
  return Math.max(0, 1 - effective / radiusM);
}

export function interestMatch(tags: string[], interests: string[] | null | undefined): number {
  if (!interests || interests.length === 0) return 0;
  const wanted = new Set(interests);
  const hits = tags.filter((tag) => wanted.has(tag)).length;
  return Math.min(hits, INTEREST_MATCH_CAP) / INTEREST_MATCH_CAP;
}

export function spectacleNorm(spectacle: number | null | undefined): number {
  const value = spectacle ?? 3;
  return (value - 1) / 4;
}

export function rankScore(input: {
  now: Date;
  peak: Interval | null;
  during: Interval;
  confidence: number;
  distM: number;
  radiusM: number;
  tags: string[];
  interests?: string[] | null;
  spectacle?: number | null;
  weights?: RankWeights;
}): number {
  const w = input.weights ?? DEFAULT_RANK_WEIGHTS;
  return (
    w.peakProximity * peakProximity(input.now, input.peak, input.during) +
    w.travelBand * travelBand(input.distM, input.radiusM) +
    w.confidence * input.confidence +
    w.interest * interestMatch(input.tags, input.interests) +
    w.spectacle * spectacleNorm(input.spectacle)
  );
}
