import { useEffect, useState } from "react";
import { Gauge, Medal } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { getCreatorRating, tierName, type CreatorRating } from "@/lib/ratingClient";

/** DQI gauge (with confidence label) + LIS tier badge and cohort percentile. */
export function CreatorRatingCard({ creatorId }: { creatorId: string }) {
  const [rating, setRating] = useState<CreatorRating | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCreatorRating(creatorId)
      .then((r) => !cancelled && setRating(r))
      .catch((err) => console.error("Rating load failed", err))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  if (!ready) return null;
  // No events yet: show the neutral starting state instead of a fake precise score.
  const dqi = rating?.dqi ?? 7;
  const sigma = rating?.sigma ?? 0.4;
  const provisional = !rating || rating.nEff < 5;
  const stale =
    rating?.lastEventAt &&
    Date.now() - new Date(rating.lastEventAt).getTime() > 1000 * 60 * 60 * 24 * 120;

  return (
    <div className="px-4 mt-4">
      <div className="rounded-lg border border-border bg-card p-4 grid sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> Quality (DQI)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{dqi.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">/ 10 ± {sigma.toFixed(1)}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, dqi * 10)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {provisional
              ? "Provisional — not enough ratings yet"
              : "Based on recent, trusted ratings"}
            {stale && rating?.lastEventAt
              ? ` · last active ${formatDistanceToNowStrict(new Date(rating.lastEventAt))} ago, score may not reflect current quality`
              : ""}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Medal className="h-3.5 w-3.5" /> Lifetime impact (LIS)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{(rating?.lis ?? 0).toFixed(1)}</span>
            <span className="text-sm font-medium">{tierName(rating?.tier ?? 0)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {rating?.lisPercentile != null
              ? `Top ${Math.max(1, 100 - rating.lisPercentile)}% of creators who joined the same year · `
              : ""}
            Last 12 months: {(rating?.activeLis ?? 0).toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}
