import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BookOpen, Eye, GitFork, Heart, Lightbulb, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid,
} from "recharts";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher dashboard — Leatha" }] }),
  component: () => (<RequireAuth><TeacherDashboard /></RequireAuth>),
});

interface LessonRow {
  id: string; title: string; view_count: number; like_count: number;
  fork_count: number; comment_count: number; created_at: string;
}
interface ClaimedSuggestion { id: string; title: string; status: string; upvote_count: number; }
interface ClassRow { id: string; name: string; description: string | null; created_at: string; }

function TeacherDashboard() {
  const { user, profile } = useAuth();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [claimed, setClaimed] = useState<ClaimedSuggestion[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      supabase.from("lessons")
        .select("id,title,view_count,like_count,fork_count,comment_count,created_at")
        .eq("author_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("lesson_suggestions")
        .select("id,title,status,upvote_count").eq("claimed_by", user.id),
      supabase.from("class_groups")
        .select("id,name,description,created_at").eq("teacher_id", user.id).order("created_at", { ascending: false }),
    ]).then(([l, s, c]) => {
      setLessons((l.data ?? []) as LessonRow[]);
      setClaimed((s.data ?? []) as ClaimedSuggestion[]);
      setClasses((c.data ?? []) as ClassRow[]);
      setLoading(false);
    });
  }, [user]);

  if (!user || !profile) return null;

  const totals = lessons.reduce(
    (a, l) => ({
      views: a.views + l.view_count, likes: a.likes + l.like_count,
      forks: a.forks + l.fork_count, comments: a.comments + l.comment_count,
    }),
    { views: 0, likes: 0, forks: 0, comments: 0 },
  );
  const chartData = lessons.slice(0, 8).map((l) => ({
    name: l.title.length > 16 ? l.title.slice(0, 14) + "…" : l.title,
    views: l.view_count, likes: l.like_count,
  })).reverse();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Teacher dashboard</h1>
          <p className="text-sm text-muted-foreground">Track how your lessons land and the classes you run.</p>
        </div>
        <Button asChild><Link to="/lessons/new"><Plus className="h-4 w-4 mr-1.5" /> New lesson</Link></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Eye} label="Total views" value={totals.views} />
        <Stat icon={Heart} label="Total likes" value={totals.likes} />
        <Stat icon={GitFork} label="Total forks" value={totals.forks} />
        <Stat icon={BookOpen} label="Lessons" value={lessons.length} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="suggestions">Claimed ({claimed.length})</TabsTrigger>
          <TabsTrigger value="classes">Classes ({classes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold mb-3">Recent lesson performance</h2>
            {chartData.length === 0 ? (
              <Empty hint="Publish lessons to see performance trends." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="likes" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lessons" className="mt-4">
          {loading ? <SkeletonList /> : lessons.length === 0 ? (
            <Empty hint="You haven't published any lessons yet." />
          ) : (
            <ul className="space-y-2">
              {lessons.map((l) => (
                <li key={l.id}>
                  <Link to="/lessons/$lessonId" params={{ lessonId: l.id }}
                    className="block rounded-md border border-border bg-card px-3 py-2.5 hover:border-primary/40 transition-colors">
                    <div className="font-medium line-clamp-1">{l.title}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-1">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{l.view_count}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{l.like_count}</span>
                      <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{l.fork_count}</span>
                      <span className="ml-auto" title={format(new Date(l.created_at), "MMM d, yyyy 'at' h:mm a")}>
                        {timeAgo(l.created_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4">
          {claimed.length === 0 ? (
            <Empty hint="Claim a suggestion to build a lesson the community wants." action={
              <Button asChild size="sm"><Link to="/suggestions"><Lightbulb className="h-3.5 w-3.5 mr-1.5" />Browse suggestions</Link></Button>
            } />
          ) : (
            <ul className="space-y-2">
              {claimed.map((s) => (
                <li key={s.id}>
                  <Link to="/suggestions/$id" params={{ id: s.id }}
                    className="block rounded-md border border-border bg-card px-3 py-2.5 hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium line-clamp-1">{s.title}</div>
                      <span className="text-xs font-mono uppercase text-primary">{s.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">{s.upvote_count} upvotes</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="classes" className="mt-4">
          {classes.length === 0 ? (
            <Empty hint="No classes yet. Classes let you group students and assign lessons." />
          ) : (
            <ul className="space-y-2">
              {classes.map((c) => (
                <li key={c.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">{c.name}</span>
                  </div>
                  {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}
function SkeletonList() {
  return <ul className="space-y-2">{[0,1,2].map(i => <li key={i} className="h-14 rounded-md border border-border bg-card animate-pulse" />)}</ul>;
}
function Empty({ hint, action }: { hint: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center">
      <div className="text-sm text-muted-foreground">{hint}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
