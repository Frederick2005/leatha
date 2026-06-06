import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Star, MessageSquare, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/find-teachers")({
  head: () => ({ meta: [{ title: "Find Teachers — Leatha" }] }),
  component: () => (<RequireAuth><FindTeachersPage /></RequireAuth>),
});

interface TeacherRow {
  user_id: string;
  subjects: string[];
  hourly_rate_cents: number;
  rating_avg: number;
  rating_count: number;
  students_count: number;
  currency: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null; bio: string | null; school: string | null } | null;
}

function FindTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any)
        .from("teacher_profiles")
        .select("user_id,subjects,hourly_rate_cents,rating_avg,rating_count,students_count,currency,profile:profiles!teacher_profiles_user_id_fkey(username,display_name,avatar_url,bio,school)")
        .eq("accepts_bookings", true)
        .order("rating_avg", { ascending: false })
        .limit(50);
      setTeachers((data ?? []) as TeacherRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = teachers.filter((t) => {
    if (!q) return true;
    const blob = `${t.profile?.username} ${t.profile?.display_name} ${t.subjects.join(" ")} ${t.profile?.school}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Find Teachers</h1>
        <p className="text-sm text-muted-foreground">Browse verified teachers and book sessions.</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, subject, school…" className="pl-9" />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="h-48 rounded-2xl border border-border bg-card animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No teachers yet. Be the first to set up a teacher profile in Settings.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.user_id} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-3">
                <UserAvatar name={t.profile?.display_name ?? t.profile?.username} url={t.profile?.avatar_url ?? null} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.profile?.display_name ?? t.profile?.username}</div>
                  <div className="text-xs text-muted-foreground font-mono">@{t.profile?.username}</div>
                  {t.profile?.school && <div className="text-xs text-muted-foreground mt-1 truncate">{t.profile.school}</div>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.subjects.slice(0, 4).map((s) => (
                  <span key={s} className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">{s}</span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  <span className="font-semibold">{t.rating_avg.toFixed(1)}</span>
                  <span className="text-muted-foreground">({t.rating_count})</span>
                </div>
                <div className="font-mono text-sm">
                  {t.currency} {(t.hourly_rate_cents / 100).toFixed(0)}<span className="text-muted-foreground">/hr</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link to="/appointments" search={{ teacher: t.user_id } as any}>
                    <Calendar className="h-3.5 w-3.5 mr-1.5" /> Book
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/messages/$username" params={{ username: t.profile?.username ?? "" }}>
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
