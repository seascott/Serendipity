import type { Family, OccurrenceScope } from "@serendipity/domain";

export type ExploreRow = {
  id: string;
  rule_id: string;
  phenomenon_id: string;
  place_id: string | null;
  phenomenon_name: string | null;
  place_name: string | null;
  scope: OccurrenceScope;
  season_key: string;
  family: Family;
  tags: string[];
  starts_at: string;
  ends_at: string;
  peak_starts_at: string | null;
  peak_ends_at: string | null;
  granularity: "day" | "instant";
  confidence: number;
  lat: number | null;
  lng: number | null;
  dist_m: number;
  score: number;
};

export type ExploreArgs = {
  lat: number;
  lng: number;
  radius_m: number;
  from_ts: string;
  to_ts: string;
  families?: Family[] | null;
  interests?: string[] | null;
};

export type RankScoreArgs = {
  during: string;
  peak: string | null;
  confidence: number;
  dist_m: number;
  radius_m: number;
  now_ts: string;
  tags: string[];
  interests: string[] | null;
  spectacle?: number | null;
};

export type Database = {
  public: {
    Tables: {
      phenomenon: {
        Row: {
          id: string;
          slug: string;
          name: string;
          family: Family;
          tags: string[];
          summary: string | null;
          status: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      explore: {
        Args: ExploreArgs;
        Returns: ExploreRow[];
      };
      rank_score: {
        Args: RankScoreArgs;
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
