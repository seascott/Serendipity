import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/constants";
import { materialize } from "../src/server";
import { UnsupportedRuleKindError } from "../src/types";
import { assertGolden, eclipse, mexicoCity, monarch, newYork, rule, saturdayMarket } from "./helpers";

const YEARS = [2025, 2026, 2027] as const;

describe("materialize fixed_annual", () => {
  const fixed = rule({
    id: "66666666-6666-4666-8666-666666666666",
    phenomenonId: monarch.id,
    placeId: mexicoCity.id,
    scope: "place",
    kind: "fixed_annual",
    params: { startMonthDay: "11-01", endMonthDay: "03-15", peakMonthDay: "01-15" },
  });

  it("emits one wrapping southern-style window per start year", () => {
    const rows = YEARS.flatMap((year) => materialize({ rule: fixed, phenomenon: monarch, place: mexicoCity, seasonYear: year }));
    expect(rows).toHaveLength(3);
    expect(rows[0]?.seasonKey).toBe("2025");
    expect(rows[0]?.during.start).toBe("2025-11-01T06:00:00.000Z");
    expect(rows[0]?.during.end).toBe("2026-03-16T06:00:00.000Z");
    expect(rows[0]?.peak?.start).toBe("2026-01-15T06:00:00.000Z");
    expect(rows[0]?.engineVersion).toBe(ENGINE_VERSION);
    assertGolden("fixed-annual-2025-2027", rows);
  });
});

describe("materialize rrule", () => {
  const weekly = rule({
    id: "77777777-7777-4777-8777-777777777777",
    phenomenonId: saturdayMarket.id,
    placeId: newYork.id,
    scope: "place",
    kind: "rrule",
    params: { rrule: "FREQ=WEEKLY;BYDAY=SA;BYMONTH=6,7,8", durationDays: 1 },
  });

  it("emits one row per Saturday in Jun–Aug", () => {
    const rows = YEARS.flatMap((year) => materialize({ rule: weekly, phenomenon: saturdayMarket, place: newYork, seasonYear: year }));
    expect(rows[0]?.seasonKey).toMatch(/^2025-06-/);
    expect(rows.every((row) => row.granularity === "day")).toBe(true);
    assertGolden("rrule-saturday-market-2025-2027", rows);
  });
});

describe("materialize explicit", () => {
  const olympics = rule({
    id: "88888888-8888-4888-8888-888888888888",
    phenomenonId: saturdayMarket.id,
    placeId: newYork.id,
    scope: "place",
    kind: "explicit",
    params: {
      windows: [
        { seasonKey: "2026", start: "2026-07-14", peak: ["2026-07-20", "2026-07-22"], end: "2026-07-30" },
        { seasonKey: "2028", start: "2028-07-14", end: "2028-07-30" },
      ],
    },
  });

  it("filters windows to the requested season year", () => {
    const rows = YEARS.flatMap((year) => materialize({ rule: olympics, phenomenon: saturdayMarket, place: newYork, seasonYear: year }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.seasonKey).toBe("2026");
    assertGolden("explicit-2025-2027", rows);
  });
});

describe("materialize astronomical(global)", () => {
  const moons = rule({
    id: "99999999-9999-4999-8999-999999999999",
    phenomenonId: eclipse.id,
    placeId: null,
    scope: "global",
    kind: "astronomical",
    params: { table: "moon_phase", filter: { phase: "new" } },
  });

  const seasons = rule({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    phenomenonId: eclipse.id,
    placeId: null,
    scope: "global",
    kind: "astronomical",
    params: { table: "equinox", filter: {} },
  });

  it("emits new moons as global instants", () => {
    const rows = YEARS.flatMap((year) => materialize({ rule: moons, phenomenon: eclipse, seasonYear: year }));
    expect(rows.every((row) => row.scope === "global" && row.geom === null)).toBe(true);
    expect(rows.every((row) => row.granularity === "instant")).toBe(true);
    expect(rows.length).toBeGreaterThan(30);
    assertGolden("astronomical-new-moon-2025-2027", rows);
  });

  it("emits equinoxes and solstices", () => {
    const rows = YEARS.flatMap((year) => materialize({ rule: seasons, phenomenon: eclipse, seasonYear: year }));
    expect(rows).toHaveLength(12);
    assertGolden("astronomical-equinox-2025-2027", rows);
  });
});

describe("materialize unsupported kinds", () => {
  it("refuses seasonal_band in P0", () => {
    const band = rule({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      phenomenonId: monarch.id,
      placeId: mexicoCity.id,
      scope: "place",
      kind: "seasonal_band",
      params: { peakDoy: 100, halfWidthDays: 10, peakSigmaDays: 4, hemisphere: "N" },
    });
    expect(() => materialize({ rule: band, phenomenon: monarch, place: mexicoCity, seasonYear: 2026 })).toThrow(
      UnsupportedRuleKindError,
    );
  });
});
