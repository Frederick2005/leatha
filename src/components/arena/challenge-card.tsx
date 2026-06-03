import { Link } from "@tanstack/react-router";
import { Clock, Flame, Users, Star } from "lucide-react";
import { DIFFICULTY_META, TYPE_META } from "@/lib/arena";
import { cn } from "@/lib/utils";

export interface ChallengeCardData {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  tags: string[];
  estimated_minutes: number;
  points_reward: number;
  solve_count: number;
  attempt_count: number;
}

export function ChallengeCard({ c }: { c: ChallengeCardData }) {
  const diff = DIFFICULTY_META[c.difficulty] ?? DIFFICULTY_META.easy;
  const type = TYPE_META[c.type] ?? TYPE_META.quiz;
  const solveRate = c.attempt_count > 0 ? Math.round((c.solve_count / c.attempt_count) * 100) : 0;
  return (
    <Link
      to="/arena/challenges/$slug"
      params={{ slug: c.slug }}
      className={cn(
        "group block rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all p-4 ring-1 ring-transparent hover:ring-2",
        diff.ring,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xl">{type.emoji}</div>
          <h3 className="font-display font-semibold text-base truncate group-hover:text-primary transition-colors">{c.title}</h3>
        </div>
        <span className={cn("text-xs font-mono uppercase tracking-wide", diff.color)}>{diff.label}</span>
      </div>
      {c.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
      <div className="mt-3 flex flex-wrap gap-1">
        {c.tags.slice(0, 4).map((t) => (
          <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {c.estimated_minutes}m</span>
        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning" /> {c.points_reward} XP</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.attempt_count}</span>
        <span className="flex items-center gap-1 ml-auto"><Flame className="h-3 w-3 text-rose-500" /> {solveRate}%</span>
      </div>
    </Link>
  );
}
