import { MS_PER_DAY } from "./constants";
import type { Interval } from "./types";

/**
 * 1 inside peak, linear to 0 at the during window edge, exponential decay beyond.
 * A missing peak is treated as a zero-width peak at the window midpoint.
 */
export function peakProximity(now: Date, peak: Interval | null, during: Interval): number {
  const t = now.getTime();
  const d0 = during.start.getTime();
  const d1 = during.end.getTime();
  if (!(d1 > d0)) return 0;

  const p0 = peak ? peak.start.getTime() : d0 + (d1 - d0) / 2;
  const p1 = peak ? Math.max(peak.end.getTime(), p0) : p0;

  if (t >= p0 && t < Math.max(p1, p0 + 1)) return 1;

  if (t >= d0 && t < d1) {
    if (t < p0) {
      const span = p0 - d0;
      return span <= 0 ? 1 : (t - d0) / span;
    }
    const span = d1 - p1;
    return span <= 0 ? 1 : (d1 - t) / span;
  }

  const beyondMs = t < d0 ? d0 - t : t - d1;
  if (beyondMs === 0) return 0;
  const tau = Math.max(d1 - d0, MS_PER_DAY);
  return Math.exp(-beyondMs / tau);
}
