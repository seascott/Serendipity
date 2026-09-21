import type { IsoInterval } from "./types";

/**
 * Shared test vectors for rank_score. `packages/domain` asserts the TypeScript
 * implementation reproduces `expected`; `jobs/src/smoke.ts` asserts the SQL
 * `rank_score()` RPC does too, so the two rankers cannot drift silently.
 */
export type RankVector = {
  name: string;
  now: string;
  during: IsoInterval;
  peak: IsoInterval | null;
  confidence: number;
  distM: number;
  radiusM: number;
  tags: string[];
  interests: string[] | null;
  spectacle: number | null;
  expected: number;
};

const june: IsoInterval = { start: "2026-06-01T00:00:00.000Z", end: "2026-06-11T00:00:00.000Z" };
const junePeak: IsoInterval = { start: "2026-06-05T00:00:00.000Z", end: "2026-06-07T00:00:00.000Z" };

export const RANK_VECTORS: readonly RankVector[] = [
  {
    name: "in peak, on the doorstep, full interest overlap, top spectacle",
    now: "2026-06-05T12:00:00.000Z",
    during: june,
    peak: junePeak,
    confidence: 0.9,
    distM: 5_000,
    radiusM: 200_000,
    tags: ["whales", "boat"],
    interests: ["whales"],
    spectacle: 5,
    expected: 0.35 + 0.25 * (1 - 7_000 / 200_000) + 0.2 * 0.9 + 0.1 * (1 / 3) + 0.1,
  },
  {
    name: "ramping toward peak, mid-radius, no interests, default spectacle",
    now: "2026-06-03T00:00:00.000Z",
    during: june,
    peak: junePeak,
    confidence: 0.8,
    distM: 50_000,
    radiusM: 200_000,
    tags: ["harvest"],
    interests: null,
    spectacle: null,
    expected: 0.35 * 0.5 + 0.25 * 0.65 + 0.2 * 0.8 + 0 + 0.1 * 0.5,
  },
  {
    name: "well past the window, beyond detour reach, capped interest overlap",
    now: "2026-07-11T00:00:00.000Z",
    during: june,
    peak: null,
    confidence: 0.4,
    distM: 180_000,
    radiusM: 200_000,
    tags: ["a", "b", "c", "d"],
    interests: ["a", "b", "c", "d"],
    spectacle: 2,
    expected: 0.35 * Math.exp(-(30 * 86_400) / (10 * 86_400)) + 0 + 0.2 * 0.4 + 0.1 + 0.1 * 0.25,
  },
  {
    name: "global instant (zero distance) before its window, no peak",
    now: "2026-09-20T00:00:00.000Z",
    during: { start: "2026-09-26T09:49:00.000Z", end: "2026-09-26T09:50:00.000Z" },
    peak: null,
    confidence: 1,
    distM: 0,
    radiusM: 300_000,
    tags: ["moon"],
    interests: ["moon", "sky"],
    spectacle: 4,
    expected: 0.35 * Math.exp(-(6 * 86_400 + 9 * 3_600 + 49 * 60) / 86_400) + 0.25 + 0.2 + 0.1 * (1 / 3) + 0.1 * 0.75,
  },
];
