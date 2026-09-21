import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { interestMatch, rankScore, travelBand } from "../src/rank-score";
import { RANK_VECTORS } from "../src/rank-vectors";

const during = {
  start: DateTime.fromISO("2026-06-01T00:00:00Z").toJSDate(),
  end: DateTime.fromISO("2026-06-11T00:00:00Z").toJSDate(),
};
const peak = {
  start: DateTime.fromISO("2026-06-05T00:00:00Z").toJSDate(),
  end: DateTime.fromISO("2026-06-07T00:00:00Z").toJSDate(),
};

describe("rankScore", () => {
  it("scores a peak, nearby, confident event above a distant off-peak one", () => {
    const now = DateTime.fromISO("2026-06-05T12:00:00Z").toJSDate();
    const near = rankScore({
      now,
      peak,
      during,
      confidence: 0.9,
      distM: 5_000,
      radiusM: 200_000,
      tags: ["whales"],
      interests: ["whales"],
      spectacle: 5,
    });
    const far = rankScore({
      now: DateTime.fromISO("2026-08-01T00:00:00Z").toJSDate(),
      peak,
      during,
      confidence: 0.4,
      distM: 180_000,
      radiusM: 200_000,
      tags: ["whales"],
      interests: ["aurora"],
      spectacle: 2,
    });
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(0.7);
  });

  it("applies the 1.4 detour factor in travelBand", () => {
    expect(travelBand(100_000, 140_000)).toBeCloseTo(0, 5);
    expect(travelBand(0, 100_000)).toBe(1);
  });

  it("reproduces the shared TS/SQL parity vectors", () => {
    for (const vector of RANK_VECTORS) {
      const score = rankScore({
        now: new Date(vector.now),
        during: { start: new Date(vector.during.start), end: new Date(vector.during.end) },
        peak: vector.peak ? { start: new Date(vector.peak.start), end: new Date(vector.peak.end) } : null,
        confidence: vector.confidence,
        distM: vector.distM,
        radiusM: vector.radiusM,
        tags: vector.tags,
        interests: vector.interests,
        spectacle: vector.spectacle,
      });
      expect(score, vector.name).toBeCloseTo(vector.expected, 9);
    }
  });

  it("caps interest overlap at 3 tags", () => {
    expect(interestMatch(["a", "b", "c", "d"], ["a", "b", "c", "d"])).toBe(1);
    expect(interestMatch(["a"], ["a", "b"])).toBeCloseTo(1 / 3, 5);
  });
});
