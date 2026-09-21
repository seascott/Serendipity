import { v5 as uuidv5 } from "uuid";
import { OCCURRENCE_NAMESPACE } from "./constants";

export function occurrenceId(
  ruleId: string,
  seasonKey: string,
  placeId: string | null,
): string {
  return uuidv5(`${ruleId}|${seasonKey}|${placeId ?? ""}`, OCCURRENCE_NAMESPACE);
}
