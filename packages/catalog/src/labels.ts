import { DateTime } from "luxon";
import { formatWindow, peakProximity, type Interval } from "@serendipity/domain";

export function confidenceLabel(confidence: number): "high" | "moderate" | "approximate" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.55) return "moderate";
  return "approximate";
}

export function confidenceCopy(confidence: number): string {
  const level = confidenceLabel(confidence);
  if (level === "high") return "High confidence — window stable within ± 2 weeks";
  if (level === "moderate") return "Moderate — dates typical but vary with conditions";
  return "Approximate dates — window shifts year to year";
}

export function peakPhrase(now: Date, peak: Interval | null, during: Interval): string {
  const prox = peakProximity(now, peak, during);
  const nowMs = now.getTime();
  const start = (peak ?? during).start.getTime();
  const end = (peak ?? during).end.getTime();
  const daysToStart = Math.round((start - nowMs) / 86_400_000);
  const daysToEnd = Math.round((end - nowMs) / 86_400_000);

  if (nowMs >= start && nowMs < end) {
    if (daysToEnd <= 2) return daysToEnd <= 0 ? "Peaking now" : `${daysToEnd} days left in peak`;
    return "Peaking now";
  }
  if (daysToStart > 0 && daysToStart <= 21) return `Peak in ${daysToStart} days`;
  if (daysToStart < 0 && nowMs < during.end.getTime()) {
    return `Peak was ${Math.abs(daysToStart)} days ago`;
  }
  if (prox > 0.6) return "Near peak";
  return "In season";
}

export function windowLabel(during: Interval, timezone: string, granularity: "day" | "instant"): string {
  return formatWindow(during, timezone, granularity);
}

export const DEMO_NOW = DateTime.fromISO("2026-09-20T09:00:00", { zone: "Europe/Rome" }).toJSDate();

export const ITALY_WINDOW = {
  from: DateTime.fromISO("2026-09-20T00:00:00", { zone: "Europe/Rome" }).toJSDate(),
  to: DateTime.fromISO("2026-10-04T00:00:00", { zone: "Europe/Rome" }).toJSDate(),
};
