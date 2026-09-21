import { DateTime } from "luxon";
import type { Granularity, Interval } from "./types";

export function formatWindow(
  during: Interval,
  timezone: string,
  granularity: Granularity,
): string {
  if (granularity === "instant") {
    return DateTime.fromJSDate(during.start, { zone: timezone }).toFormat("MMM d, yyyy, HH:mm ZZZZ");
  }

  const start = DateTime.fromJSDate(during.start, { zone: timezone });
  const endInclusive = DateTime.fromJSDate(during.end, { zone: timezone }).minus({ milliseconds: 1 });

  if (start.hasSame(endInclusive, "day")) {
    return start.toFormat("MMM d, yyyy");
  }
  if (start.hasSame(endInclusive, "year") && start.hasSame(endInclusive, "month")) {
    return `${start.toFormat("MMM d")}–${endInclusive.toFormat("d, yyyy")}`;
  }
  if (start.hasSame(endInclusive, "year")) {
    return `${start.toFormat("MMM d")}–${endInclusive.toFormat("MMM d, yyyy")}`;
  }
  return `${start.toFormat("MMM d, yyyy")}–${endInclusive.toFormat("MMM d, yyyy")}`;
}

export function toIso(date: Date): string {
  return date.toISOString();
}
