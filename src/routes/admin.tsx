import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Shield, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { RequireAuth } from "@/components/require-auth";

type ReportTargetType = Database["public"]["Enums"]["report_target_type"];
type ReportStatus = Database["public"]["Enums"]["report_status"];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Moderation — SkillChain" }],
  }),
  component: () => (<RequireAuth><AdminPage /></RequireAuth>),
});

interface ReportRow {
  id: string;
  reported_by: string;
  target_id: string;
  target_type: ReportTargetType;
  reason: string;
  status: ReportStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  created_at: string;
  reporter?: { username: string; display_name: string | null; avatar_url: string | null } | null;
  preview?: string | null;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  lesson_count: number;
  created_at: string;
  roles: string[];
}

interface LessonRow {
  id: string;
  title: string;
  slug: string;
  author_id: string;
  like_count: number;
  fork_count: number;
  is_published: boolean;
  created_at: string;
  author?: { username: string; display_name: string | null } | null;
}

interface AdminSummary {
  total_users: number;
  total_lessons: number;
  pending_reports: number;
  moderator_count: number;
  admin_count: number;
}

function AdminPage() {
  const { isModOrAdmin, isAdmin, loading } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const loadSummary = async () => {
    setSummaryLoading(true);
    const [usersRes, lessonsRes, pendingRes, modsRes, adminsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("lessons").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "moderator"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
    ]);

    setSummary({
      total_users: usersRes.count ?? 0,
      total_lessons: lessonsRes.count ?? 0,
      pending_reports: pendingRes.count ?? 0,
      moderator_count: modsRes.count ?? 0,
      admin_count: adminsRes.count ?? 0,
    });
    setSummaryLoading(false);
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  if (!isModOrAdmin) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Restricted</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You need moderator or admin privileges to view this page.
        </p>
        <Button asChild className="mt-4"><Link to="/">Back to feed</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Moderation Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review reports and manage content {isAdmin && "· you have full admin rights"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 mb-6 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
        {summaryLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 rounded-3xl border border-border bg-card animate-pulse" />
          ))
        ) : (
          <>
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground uppercase tracking-[0.18em]">Pending reports</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{summary?.pending_reports ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-2">Reports waiting for review</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground uppercase tracking-[0.18em]">Total content</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{summary?.total_lessons ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-2">Lessons available on SkillChain</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground uppercase tracking-[0.18em]">Community leaders</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{summary?.moderator_count ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-2">Active moderators on duty</p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-surface p-5 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Moderator guidance</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Use this dashboard to triage content quickly. Start with reports, then confirm profile concerns and clean up harmful lessons.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={loadSummary}>Refresh summary</Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/admin">Open reports</Link>
            </Button>
          </div>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="rounded-2xl border border-border bg-card p-3 text-sm">
            <span className="font-semibold">Resolve pending reports</span>
            <p className="text-muted-foreground mt-1">Mark reviews as resolved or dismiss them when content is safe.</p>
          </li>
          <li className="rounded-2xl border border-border bg-card p-3 text-sm">
            <span className="font-semibold">Manage users</span>
            <p className="text-muted-foreground mt-1">Promote trusted members to moderators or revoke access when needed.</p>
          </li>
        </ul>
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="lessons" className="mt-4"><LessonsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    let q = supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data: rs } = await q;
    const rows = (rs ?? []) as ReportRow[];

    const reporterIds = Array.from(new Set(rows.map((r) => r.reported_by)));
    if (reporterIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", reporterIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        const p = map.get(r.reported_by);
        if (p) r.reporter = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url };
      });
    }

    const lessonIds = rows.filter((r) => r.target_type === "lesson").map((r) => r.target_id);
    const commentIds = rows.filter((r) => r.target_type === "comment").map((r) => r.target_id);
    const chatIds = rows.filter((r) => r.target_type === "chat_message").map((r) => r.target_id);
    const userIds = rows.filter((r) => r.target_type === "user").map((r) => r.target_id);

    const [lessons, comments, chats, users] = await Promise.all([
      lessonIds.length ? supabase.from("lessons").select("id, title").in("id", lessonIds) : { data: [] },
      commentIds.length ? supabase.from("comments").select("id, body").in("id", commentIds) : { data: [] },
      chatIds.length ? supabase.from("chat_messages").select("id, body").in("id", chatIds) : { data: [] },
      userIds.length ? supabase.from("profiles").select("id, username").in("id", userIds) : { data: [] },
    ]);
    const previews = new Map<string, string>();
    (lessons.data ?? []).forEach((l) => previews.set(l.id, `Lesson: ${l.title}`));
    (comments.data ?? []).forEach((c) => previews.set(c.id, `Comment: ${c.body.slice(0, 120)}`));
    (chats.data ?? []).forEach((c) => previews.set(c.id, `Chat: ${c.body.slice(0, 120)}`));
    (users.data ?? []).forEach((u) => previews.set(u.id, `User: @${u.username}`));
    rows.forEach((r) => { r.preview = previews.get(r.target_id) ?? null; });

    setReports(rows);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filter]);

  const resolve = async (r: ReportRow, status: ReportStatus, removeContent: boolean) => {
    const note = noteDraft[r.id] ?? "";
    if (removeContent) {
      if (r.target_type === "lesson") await supabase.from("lessons").delete().eq("id", r.target_id);
      else if (r.target_type === "comment") await supabase.from("comments").delete().eq("id", r.target_id);
      else if (r.target_type === "chat_message") await supabase.from("chat_messages").delete().eq("id", r.target_id);
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("reports")
      .update({ status, resolution_note: note || null, resolved_by: user?.id ?? null })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(`Report ${status}`);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>
          Pending
        </Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && reports.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
          No reports {filter === "pending" ? "awaiting review" : "found"}.
        </div>
      )}

      {reports.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-4 bg-surface">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono uppercase text-[10px]">{r.target_type}</Badge>
              <Badge
                variant={r.status === "pending" ? "default" : r.status === "resolved" ? "secondary" : "outline"}
              >
                {r.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </span>
            </div>
            {r.reporter && (
              <Link to="/u/$username" params={{ username: r.reporter.username }} className="flex items-center gap-2 text-xs hover:opacity-80">
                <UserAvatar name={r.reporter.display_name ?? r.reporter.username} url={r.reporter.avatar_url} size="sm" />
                <span>@{r.reporter.username}</span>
              </Link>
            )}
          </div>

          <div className="mt-3 text-sm">
            <div className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Reason
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap mt-1">{r.reason}</p>
          </div>

          {r.preview && (
            <div className="mt-3 p-3 rounded border border-border bg-background text-sm">
              <div className="text-xs text-muted-foreground mb-1">Reported content</div>
              <div className="break-words">{r.preview}</div>
              {r.target_type === "lesson" && (
                <Link
                  to="/lessons/$lessonId"
                  params={{ lessonId: r.target_id }}
                  className="text-xs text-primary hover:underline mt-2 inline-block"
                >
                  View lesson →
                </Link>
              )}
            </div>
          )}

          {r.resolution_note && r.status !== "pending" && (
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold">Resolution: </span>{r.resolution_note}
            </div>
          )}

          {r.status === "pending" && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Resolution note (optional)"
                value={noteDraft[r.id] ?? ""}
                onChange={(e) => setNoteDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                rows={2}
                className="text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {(r.target_type === "lesson" || r.target_type === "comment" || r.target_type === "chat_message") && (
                  <Button size="sm" variant="destructive" onClick={() => resolve(r, "resolved", true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove content & resolve
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => resolve(r, "resolved", false)}>
                  <CheckCircle className="h-3.5 w-3.5" /> Mark resolved
                </Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(r, "dismissed", false)}>
                  <XCircle className="h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, points, lesson_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (search.trim()) q = q.ilike("username", `%${search.trim()}%`);
    const { data: profs } = await q;
    const ids = (profs ?? []).map((p) => p.id);
    let rolesMap = new Map<string, string[]>();
    if (ids.length) {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      (roles ?? []).forEach((r) => {
        const list = rolesMap.get(r.user_id) ?? [];
        list.push(r.role);
        rolesMap.set(r.user_id, list);
      });
    }
    setUsers((profs ?? []).map((p) => ({ ...p, roles: rolesMap.get(p.id) ?? ["user"] })) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search]);

  const toggleRole = async (userId: string, role: "moderator" | "admin", has: boolean) => {
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Role updated");
    void load();
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by username…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-accent/30">
            <Link to="/u/$username" params={{ username: u.username }}>
              <UserAvatar name={u.display_name ?? u.username} url={u.avatar_url} size="md" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link to="/u/$username" params={{ username: u.username }} className="font-semibold hover:text-primary truncate">
                  {u.display_name ?? u.username}
                </Link>
                <span className="text-xs text-muted-foreground font-mono">@{u.username}</span>
                {u.roles.filter((r) => r !== "user").map((r) => (
                  <Badge key={r} variant="secondary" className="text-[10px] uppercase">{r}</Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {u.points} pts · {u.lesson_count} lessons · joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={u.roles.includes("moderator") ? "secondary" : "outline"}
                  onClick={() => toggleRole(u.id, "moderator", u.roles.includes("moderator"))}
                >
                  {u.roles.includes("moderator") ? "Remove mod" : "Make mod"}
                </Button>
                <Button
                  size="sm"
                  variant={u.roles.includes("admin") ? "secondary" : "outline"}
                  onClick={() => toggleRole(u.id, "admin", u.roles.includes("admin"))}
                >
                  {u.roles.includes("admin") ? "Remove admin" : "Make admin"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonsTab() {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("lessons")
      .select("id, title, slug, author_id, like_count, fork_count, is_published, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
    const { data: ls } = await q;
    const authorIds = Array.from(new Set((ls ?? []).map((l) => l.author_id)));
    let amap = new Map<string, { username: string; display_name: string | null }>();
    if (authorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name").in("id", authorIds);
      amap = new Map((profs ?? []).map((p) => [p.id, { username: p.username, display_name: p.display_name }]));
    }
    setLessons((ls ?? []).map((l) => ({ ...l, author: amap.get(l.author_id) ?? null })) as LessonRow[]);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search]);

  const remove = async (id: string) => {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lesson removed");
    void load();
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {lessons.map((l) => (
          <div key={l.id} className="flex items-center gap-3 p-3 hover:bg-accent/30">
            <div className="flex-1 min-w-0">
              <Link
                to="/lessons/$lessonId"
                params={{ lessonId: l.id }}
                className="font-semibold hover:text-primary block truncate"
              >
                {l.title}
              </Link>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                {l.author && <>by @{l.author.username} ·</>}
                <span>{l.like_count} likes</span>·
                <span>{l.fork_count} forks</span>·
                <span>{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</span>
                {!l.is_published && <Badge variant="outline" className="text-[10px]">draft</Badge>}
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => remove(l.id)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
