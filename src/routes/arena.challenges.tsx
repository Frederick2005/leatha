import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChallengeCard, type ChallengeCardData } from "@/components/arena/challenge-card";
import { DIFFICULTY_META, TYPE_META } from "@/lib/arena";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/arena/challenges")({ component: BrowserPage });

function BrowserPage() {
  const [items, setItems] = useState<ChallengeCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [diff, setDiff] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    void supabase
      .from("arena_challenges")
      .select("id,slug,title,description,type,difficulty,tags,estimated_minutes,points_reward,solve_count,attempt_count")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { setItems((data ?? []) as ChallengeCardData[]); setLoading(false); });
  }, []);

  const filtered = useMemo(() => items.filter((c) => {
    if (type && c.type !== type) return false;
    if (diff && c.difficulty !== diff) return false;
    if (q && !`${c.title} ${c.description} ${c.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, type, diff]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-bold">All challenges</h1>
        <p className="text-sm text-muted-foreground">Pick a difficulty, type, or search.</p>
      </header>

      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search challenges, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FilterRow label="Type" current={type} setCurrent={setType} options={Object.entries(TYPE_META).map(([v, m]) => ({ value: v, label: `${m.emoji} ${m.label}` }))} />
        <FilterRow label="Difficulty" current={diff} setCurrent={setDiff} options={Object.entries(DIFFICULTY_META).map(([v, m]) => ({ value: v, label: m.label }))} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No challenges match. Try clearing filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => <ChallengeCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, current, setCurrent, options }: { label: string; current: string; setCurrent: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
      <span className="text-xs uppercase font-mono text-muted-foreground shrink-0">{label}</span>
      <button onClick={() => setCurrent("")} className={cn("px-2.5 py-1 rounded-full text-xs border whitespace-nowrap", !current ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}>All</button>
      {options.map((o) => (
        <button key={o.value} onClick={() => setCurrent(o.value)} className={cn("px-2.5 py-1 rounded-full text-xs border whitespace-nowrap", current === o.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
