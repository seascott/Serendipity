import { RPC } from "@serendipity/domain";
import type { SerendipityClient } from "./client";
import type { ExploreArgs, ExploreRow } from "./database.types";

export async function explore(client: SerendipityClient, args: ExploreArgs): Promise<ExploreRow[]> {
  const { data, error } = await client.rpc(RPC.explore, {
    lat: args.lat,
    lng: args.lng,
    radius_m: args.radius_m,
    from_ts: args.from_ts,
    to_ts: args.to_ts,
    families: args.families ?? undefined,
    interests: args.interests ?? undefined,
  });
  if (error) throw error;
  return data ?? [];
}
