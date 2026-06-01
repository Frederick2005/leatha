export const DIFFICULTY_META: Record<string, { label: string; color: string; ring: string }> = {
  easy:   { label: "Easy",   color: "text-emerald-500", ring: "ring-emerald-500/30" },
  medium: { label: "Medium", color: "text-amber-500",   ring: "ring-amber-500/30" },
  hard:   { label: "Hard",   color: "text-rose-500",    ring: "ring-rose-500/30" },
  expert: { label: "Expert", color: "text-purple-500",  ring: "ring-purple-500/30" },
};

export const TYPE_META: Record<string, { label: string; emoji: string }> = {
  quiz:       { label: "Quiz",        emoji: "🧠" },
  code:       { label: "Code",        emoji: "💻" },
  math:       { label: "Math",        emoji: "➗" },
  science:    { label: "Science",     emoji: "🔬" },
  language:   { label: "Language",    emoji: "🗣️" },
  essay:      { label: "Essay",       emoji: "✍️" },
  logic:      { label: "Logic",       emoji: "🧩" },
  simulation: { label: "Simulation",  emoji: "🎮" },
};

export const RANK_THRESHOLDS = [
  { rank: "Bronze",    xp: 0 },
  { rank: "Silver",    xp: 200 },
  { rank: "Gold",      xp: 600 },
  { rank: "Platinum",  xp: 1500 },
  { rank: "Diamond",   xp: 3500 },
  { rank: "Master",    xp: 7000 },
  { rank: "Grandmaster", xp: 14000 },
];

export function rankFor(xp: number) {
  let current = RANK_THRESHOLDS[0];
  let next = RANK_THRESHOLDS[1];
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (xp >= RANK_THRESHOLDS[i].xp) {
      current = RANK_THRESHOLDS[i];
      next = RANK_THRESHOLDS[i + 1] ?? RANK_THRESHOLDS[i];
    }
  }
  const span = Math.max(next.xp - current.xp, 1);
  const pct = next === current ? 100 : Math.min(100, Math.round(((xp - current.xp) / span) * 100));
  return { current, next, pct };
}

export function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "challenge";
}
