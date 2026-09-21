import { buildOccurrences } from "./build";
import { seed } from "./data";
import type { OccurrenceView } from "./types";

let cached: OccurrenceView[] | null = null;

export function getCatalog(): OccurrenceView[] {
  cached ??= buildOccurrences();
  return cached;
}

export { seed };
export { hydrateOccurrences } from "./hydrate";
export type { OccurrenceRecord } from "./hydrate";
