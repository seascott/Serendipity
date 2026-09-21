import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SerendipityClient } from "./client";
import type { ExploreArgs, ExploreRow } from "./database.types";
import { explore } from "./explore";

export function exploreQueryKey(args: ExploreArgs) {
  return ["explore", args] as const;
}

export function useExplore(
  client: SerendipityClient | null,
  args: ExploreArgs | null,
): UseQueryResult<ExploreRow[]> {
  return useQuery({
    queryKey: args ? exploreQueryKey(args) : ["explore", "idle"],
    queryFn: () => {
      if (!client || !args) return [];
      return explore(client, args);
    },
    enabled: Boolean(client && args),
  });
}
