import { supabase } from "@/integrations/supabase/client";

/**
 * Read-only access to a creator's Leatha rating (see Leatha_Rating_System_Reference).
 * Scores are computed inside Postgres from server-side events (reviews, forks, publishing,
 * Arena passes); the browser can never submit or alter rating events.
 */
export interface CreatorRating {
  dqi: number; // live 0-10 quality score
  sigma: number; // confidence band (+/-)
  nEff: number; // effective evidence weight
  lis: number; // lifetime impact score
  activeLis: number; // trailing 12 months
  tier: number;
  lisPercentile: number | null; // within join-year cohort
  lastEventAt: string | null;
}

export const TIER_NAMES = ["Starter", "Bronze", "Silver", "Gold", "Platinum", "Legend"];
export const tierName = (tier: number) =>
  TIER_NAMES[Math.min(Math.max(tier, 0), TIER_NAMES.length - 1)];

export async function getCreatorRating(creatorId: string): Promise<CreatorRating | null> {
  const { data, error } = await supabase
    .from("creator_rating_public" as never)
    .select("dqi, sigma, n_eff, lis, active_lis, tier, lis_percentile, last_event_at")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = data as Record<string, number | string | null>;
  return {
    dqi: Number(d.dqi),
    sigma: Number(d.sigma),
    nEff: Number(d.n_eff),
    lis: Number(d.lis),
    activeLis: Number(d.active_lis),
    tier: Number(d.tier),
    lisPercentile: d.lis_percentile == null ? null : Number(d.lis_percentile),
    lastEventAt: (d.last_event_at as string | null) ?? null,
  };
}
