import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { collections } from "../src/data";
import { DEMO_NOW, ITALY_WINDOW } from "../src/labels";
import { getCatalog } from "../src/server";
import { buildItinerary, itineraryGrain } from "../src/itinerary";
import { happeningSoon, tierExplore, yearBands } from "../src/select";
import { places } from "../src/data";

const florence = places.find((place) => place.slug === "florence")!;

describe("catalog seed", () => {
  it("materializes every rule without throwing", () => {
    const rows = getCatalog();
    expect(rows.length).toBeGreaterThan(80);
  });

  it("keeps the Italy fortnight from going empty", () => {
    const { nearby, detour, coming, sky } = tierExplore({
      rows: getCatalog(),
      now: DEMO_NOW,
      from: ITALY_WINDOW.from,
      to: ITALY_WINDOW.to,
      origin: { lat: florence.lat, lng: florence.lng },
    });
    expect(nearby.length + detour.length).toBeGreaterThanOrEqual(5);
    expect(coming.length).toBeGreaterThanOrEqual(1);
    expect(sky.length).toBeGreaterThanOrEqual(1);
  });

  it("covers all twelve months in the Planet Earth year", () => {
    const collection = collections[0]!;
    const bands = yearBands(getCatalog(), collection, 2026);
    const months = new Set<number>();
    for (const row of bands) {
      for (const window of row.windows) {
        let cursor = DateTime.fromJSDate(window.start).startOf("month");
        const end = DateTime.fromJSDate(window.end);
        while (cursor < end && cursor.year <= 2026) {
          if (cursor.year === 2026) months.add(cursor.month);
          cursor = cursor.plus({ months: 1 });
        }
      }
    }
    expect([...months].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("has a happening-soon rail", () => {
    expect(happeningSoon(getCatalog(), DEMO_NOW).length).toBeGreaterThanOrEqual(3);
  });

  it("chooses itinerary grain from window length", () => {
    expect(itineraryGrain(new Date("2026-01-01"), new Date("2027-01-01"))).toBe("month");
    expect(itineraryGrain(new Date("2026-09-01"), new Date("2026-10-01"))).toBe("week");
    expect(itineraryGrain(ITALY_WINDOW.from, ITALY_WINDOW.to)).toBe("day");
    expect(itineraryGrain(new Date("2026-09-20"), new Date("2026-09-22"))).toBe("half-day");
  });

  it("builds a day itinerary with distance and transit for Italy", () => {
    const { nearby, detour, sky } = tierExplore({
      rows: getCatalog(),
      now: DEMO_NOW,
      from: ITALY_WINDOW.from,
      to: ITALY_WINDOW.to,
      origin: { lat: florence.lat, lng: florence.lng },
    });
    const { grain, blocks } = buildItinerary({
      cards: [...nearby, ...detour, ...sky],
      from: ITALY_WINDOW.from,
      to: ITALY_WINDOW.to,
      zone: "Europe/Rome",
      showOriginTravel: true,
    });
    expect(grain).toBe("day");
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(blocks.some((block) => block.stops.some((stop) => stop.travelPhrase.includes("km")))).toBe(true);
    expect(blocks.some((block) => block.grain === "half-day")).toBe(true);
  });
});
