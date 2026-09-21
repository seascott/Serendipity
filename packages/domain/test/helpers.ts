import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import type { OccurrenceDraft, PhenomenonInput, PlaceInput, RuleRecord } from "../src/types";

const goldensDir = join(dirname(fileURLToPath(import.meta.url)), "goldens");

export const mexicoCity: PlaceInput = {
  id: "11111111-1111-4111-8111-111111111111",
  timezone: "America/Mexico_City",
  latitude: 19.43,
  longitude: -99.13,
  hemisphere: "N",
};

export const newYork: PlaceInput = {
  id: "22222222-2222-4222-8222-222222222222",
  timezone: "America/New_York",
  latitude: 40.71,
  longitude: -74.01,
  hemisphere: "N",
};

export const alba: PlaceInput = {
  id: "66666666-6666-4666-8666-666666666666",
  timezone: "Europe/Rome",
  latitude: 44.7,
  longitude: 8.03,
  hemisphere: "N",
};

export const auckland: PlaceInput = {
  id: "77777777-7777-4777-8777-777777777777",
  timezone: "Pacific/Auckland",
  latitude: -36.85,
  longitude: 174.76,
  hemisphere: "S",
};

export const monarch: PhenomenonInput = {
  id: "33333333-3333-4333-8333-333333333333",
  family: "wildlife",
  tags: ["migration", "butterflies"],
};

export const saturdayMarket: PhenomenonInput = {
  id: "44444444-4444-4444-8444-444444444444",
  family: "cultural",
  tags: ["market"],
};

export const eclipse: PhenomenonInput = {
  id: "55555555-5555-4555-8555-555555555555",
  family: "astronomy",
  tags: ["sky"],
};

export function rule(partial: Omit<RuleRecord, "active" | "version" | "confidence"> & Partial<RuleRecord>): RuleRecord {
  return {
    confidence: 0.85,
    version: 1,
    active: true,
    ...partial,
  };
}

export function assertGolden(name: string, rows: OccurrenceDraft[]): void {
  const path = join(goldensDir, `${name}.json`);
  if (process.env.UPDATE_GOLDENS === "1") {
    writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`);
  }
  const expected = JSON.parse(readFileSync(path, "utf8")) as OccurrenceDraft[];
  expect(rows).toEqual(expected);
}
