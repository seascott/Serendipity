import { OCCURRENCE_NAMESPACE } from "@serendipity/domain";
import { v5 as uuidv5 } from "uuid";

export function slugId(slug: string): string {
  return uuidv5(slug, OCCURRENCE_NAMESPACE);
}
