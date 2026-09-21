import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { peakProximity } from "../src/peak-proximity";

const during = {
  start: DateTime.fromISO("2026-06-01T00:00:00Z").toJSDate(),
  end: DateTime.fromISO("2026-06-11T00:00:00Z").toJSDate(),
};
const peak = {
  start: DateTime.fromISO("2026-06-05T00:00:00Z").toJSDate(),
  end: DateTime.fromISO("2026-06-07T00:00:00Z").toJSDate(),
};

describe("peakProximity", () => {
  it("is 1 inside the peak", () => {
    expect(peakProximity(DateTime.fromISO("2026-06-05T12:00:00Z").toJSDate(), peak, during)).toBe(1);
  });

  it("is 0 at the window start and end edges", () => {
    expect(peakProximity(during.start, peak, during)).toBe(0);
    expect(peakProximity(during.end, peak, during)).toBeLessThan(0.01);
  });

  it("rises linearly from the start edge to the peak", () => {
    const mid = DateTime.fromISO("2026-06-03T00:00:00Z").toJSDate();
    expect(peakProximity(mid, peak, during)).toBeCloseTo(0.5, 5);
  });

  it("decays exponentially outside the window", () => {
    const after = DateTime.fromISO("2026-06-21T00:00:00Z").toJSDate();
    const score = peakProximity(after, peak, during);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.4);
  });
});
