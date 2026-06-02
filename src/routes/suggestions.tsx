import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SuggestionCard, type SuggestionRow } from "@/components/suggestion-card";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/suggestions")({
  component: () => (<RequireAuth><SuggestionsFeed /></RequireAuth>),
});

const SORTS = [
  { v: "top", l: "Most upvoted" },
  { v: "new", l: "Newest" },
  { v: "viewed", l: "Most viewed" },
] as const;

const STATUSES = [
  { v: "all", l: "All status" },
  { v: "open", l: "Open" },
  { v: "in_progress", l: "In progress" },
  { v: "completed", l: "Completed" },
] as const;

function SuggestionsFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<(typeof SORTS)[number]["v"]>("top");
  const [status, setStatus] = useState<(typeof STATUSES)[number]["v"]>("all");
  const [subject, setSubject] = useState<string>("all");
  const [myUpvotes, setMyUpvotes] = useState<Set<string>>(new Set());

  const subjects = useMemo(() => {
    const s = new Set(items.map((i) => i.subject));
    return ["all", ...Array.from(s).sort()];
  }, [items]);

  const reload = async () => {
    setLoading(true);
    const orderCol = sort === "top" ? "upvote_count" : sort === "viewed" ? "view_count" : "created_at";
    let q = supabase
      .from("lesson_suggestions")
      .select(`*,
        suggester:profiles!lesson_suggestions_suggested_by_fkey(id,username,display_name,avatar_url),
        claimer:profiles!lesson_suggestions_claimed_by_fkey(username)`)
      .order(orderCol, { ascending: false })
      .limit(100);
    if (status !== "all") q = q.eq("status", status);
    if (subject !== "all") q = q.eq("subject", subject);
    const { data, error } = await q;
    if (error) {
      // fallback without joins if FK names differ
      const { data: d2 } = await supabase.from("lesson_suggestions").select("*").order(orderCol, { ascending: false }).limit(100);
      setItems((d2 ?? []) as unknown as SuggestionRow[]);
    } else {
      setItems((data ?? []) as unknown as SuggestionRow[]);
    }
    if (user) {
      const { data: up } = await supabase.from("suggestion_upvotes").select("suggestion_id").eq("user_id", user.id);
      setMyUpvotes(new Set((up ?? []).map((r: { suggestion_id: string }) => r.suggestion_id)));
    }
    setLoading(false);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sort, status, subject, user?.id]);

  const handleUpvote = async (s: SuggestionRow) => {
    if (!user) return;
    if (myUpvotes.has(s.id)) {
      await supabase.from("suggestion_upvotes").delete().eq("suggestion_id", s.id).eq("user_id", user.id);
      setMyUpvotes((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
      setItems((prev) => prev.map((x) => x.id === s.id ? { ...x, upvote_count: Math.max(0, x.upvote_count - 1) } : x));
    } else {
      const { error } = await supabase.from("suggestion_upvotes").insert({ suggestion_id: s.id, user_id: user.id });
      if (error) { toast.error("Couldn't upvote"); return; }
      setMyUpvotes((prev) => new Set(prev).add(s.id));
      setItems((prev) => prev.map((x) => x.id === s.id ? { ...x, upvote_count: x.upvote_count + 1 } : x));
      void trackEvent("suggestion_upvote", { suggestion_id: s.id, subject: s.subject });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" /> Lesson Suggestions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Ask the community — and teachers — for lessons you want to learn.</p>
        </div>
        <Button asChild><Link to="/suggestions/new"><Plus className="h-4 w-4 mr-1" /> Suggest</Link></Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>{SORTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All subjects" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <Lightbulb className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No suggestions yet.</p>
          <Button asChild className="mt-3"><Link to="/suggestions/new">Be the first</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SuggestionCard key={s.id} s={{ ...s, hasUpvoted: myUpvotes.has(s.id), onUpvote: () => handleUpvote(s) }} />
          ))}
        </div>
      )}
    </div>
  );
}
