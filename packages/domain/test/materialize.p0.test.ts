import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/constants";
import { materialize } from "../src/server";
import { RuleValidationError, UnsupportedRuleKindError } from "../src/types";
import { DateTime } from "luxon";
import { alba, assertGolden, auckland, eclipse, mexicoCity, monarch, newYork, rule, saturdayMarket } from "./helpers";

function localWeekday(iso: string, zone: string): string {
  return DateTime.fromISO(iso, { zone }).toFormat("ccc");
}

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

  it("keeps BYDAY on the civil calendar east of UTC (Europe/Rome)", () => {
    const fair = rule({
      id: "77777777-7777-4777-8777-777777777771",
      phenomenonId: saturdayMarket.id,
      placeId: alba.id,
      scope: "place",
      kind: "rrule",
      params: { rrule: "FREQ=WEEKLY;BYDAY=SA;BYMONTH=10", durationDays: 2 },
    });
    const rows = materialize({ rule: fair, phenomenon: saturdayMarket, place: alba, seasonYear: 2026 });
    expect(rows.map((row) => row.seasonKey)).toEqual([
      "2026-10-03",
      "2026-10-10",
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
    ]);
    expect(rows.every((row) => localWeekday(row.during.start, alba.timezone) === "Sat")).toBe(true);
    expect(rows[0]?.during.start).toBe("2026-10-02T22:00:00.000Z");
    expect(rows[4]?.during.end).toBe("2026-11-01T23:00:00.000Z");
    assertGolden("rrule-alba-saturdays-2026", rows);
  });

  it("keeps BYDAY on the civil calendar far east of UTC (Pacific/Auckland)", () => {
    const market = rule({
      id: "77777777-7777-4777-8777-777777777772",
      phenomenonId: saturdayMarket.id,
      placeId: auckland.id,
      scope: "place",
      kind: "rrule",
      params: { rrule: "FREQ=WEEKLY;BYDAY=SU;BYMONTH=1", durationDays: 1 },
    });
    const rows = materialize({ rule: market, phenomenon: saturdayMarket, place: auckland, seasonYear: 2026 });
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => localWeekday(row.during.start, auckland.timezone) === "Sun")).toBe(true);
    expect(rows.every((row) => row.seasonKey.startsWith("2026-01-"))).toBe(true);
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

  it("emits only the requested season events", () => {
    const september = rule({ ...seasons, params: { table: "equinox", filter: { events: ["sep_equinox"] } } });
    const rows = YEARS.flatMap((year) => materialize({ rule: september, phenomenon: eclipse, seasonYear: year }));
    expect(rows.map((row) => row.seasonKey)).toEqual(["2025-sep-equinox", "2026-sep-equinox", "2027-sep-equinox"]);
    expect(rows.every((row) => row.during.start.startsWith(`${row.seasonKey.slice(0, 4)}-09-2`))).toBe(true);
  });

  it("rejects unknown equinox filter keys", () => {
    const legacy = rule({ ...seasons, params: { table: "equinox", filter: { events: "equinox_only" } } });
    expect(() => materialize({ rule: legacy, phenomenon: eclipse, seasonYear: 2026 })).toThrow(RuleValidationError);
  });

  it("picks the single full moon nearest the September equinox for nearestTo", () => {
    const harvest = rule({
      ...moons,
      params: { table: "moon_phase", filter: { phase: "full", nearestTo: "sep_equinox" } },
    });
    const rows = YEARS.flatMap((year) => materialize({ rule: harvest, phenomenon: eclipse, seasonYear: year }));
    // USNO: 2025-10-07, 2026-09-26, 2027-09-15 are the Harvest Moons.
    expect(rows.map((row) => row.seasonKey)).toEqual(["2025-10-07-full", "2026-09-26-full", "2027-09-15-full"]);
  });

  it("restricts moon phases to the given months", () => {
    const autumn = rule({ ...moons, params: { table: "moon_phase", filter: { phase: ["full"], months: [9, 10] } } });
    const rows = materialize({ rule: autumn, phenomenon: eclipse, seasonYear: 2026 });
    expect(rows.map((row) => row.seasonKey)).toEqual(["2026-09-26-full", "2026-10-26-full"]);
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
