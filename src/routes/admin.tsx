import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow, format, subDays, startOfDay } from "date-fns";
import {
  Shield, Trash2, CheckCircle, XCircle, AlertTriangle, Users, BookOpen, MessageSquareWarning,
  Megaphone, Activity, Star, Flag, TrendingUp, Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { Database } from "@/integrations/supabase/types";
import { RequireAuth } from "@/components/require-auth";

type ReportTargetType = Database["public"]["Enums"]["report_target_type"];
type ReportStatus = Database["public"]["Enums"]["report_status"];

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — SkillChain" }] }),
  component: () => (<RequireAuth><AdminPage /></RequireAuth>),
});

// ───────────────────────────── Helpers ─────────────────────────────
async function logAdminAction(action: string, target_type?: string, target_id?: string, details: Record<string, unknown> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action,
    target_type: target_type ?? null,
    target_id: target_id ?? null,
    details: details as never,
  });
}

type FeedbackPatch = Partial<Omit<FeedbackRow, "user">>;

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  open: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  in_review: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  dismissed: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
};

// ───────────────────────────── Root ─────────────────────────────
function AdminPage() {
  const { isModOrAdmin, isAdmin, loading } = useAuth();

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isModOrAdmin) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Restricted</h1>
        <p className="text-sm text-muted-foreground mt-2">Moderator or admin privileges required.</p>
        <Button asChild className="mt-4"><Link to="/">Back to feed</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Full administrator access" : "Moderator access"}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="overview"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1.5" />Users</TabsTrigger>
          <TabsTrigger value="lessons"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Content</TabsTrigger>
          <TabsTrigger value="reports"><Flag className="h-3.5 w-3.5 mr-1.5" />Reports</TabsTrigger>
          <TabsTrigger value="feedback"><MessageSquareWarning className="h-3.5 w-3.5 mr-1.5" />Feedback</TabsTrigger>
          {isAdmin && <TabsTrigger value="announcements"><Megaphone className="h-3.5 w-3.5 mr-1.5" />Announcements</TabsTrigger>}
          <TabsTrigger value="analytics"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="logs"><Activity className="h-3.5 w-3.5 mr-1.5" />Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="lessons" className="mt-6"><LessonsTab /></TabsContent>
        <TabsContent value="reports" className="mt-6"><ReportsTab /></TabsContent>
        <TabsContent value="feedback" className="mt-6"><FeedbackTab /></TabsContent>
        {isAdmin && <TabsContent value="announcements" className="mt-6"><AnnouncementsTab /></TabsContent>}
        <TabsContent value="analytics" className="mt-6"><AnalyticsTab /></TabsContent>
        <TabsContent value="logs" className="mt-6"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────────── Overview ─────────────────────────────
function StatCard({ icon: Icon, label, value, hint, tone = "primary" }: { icon: React.ElementType; label: string; value: number | string; hint?: string; tone?: "primary" | "warn" | "good" | "muted" }) {
  const tones = {
    primary: "from-primary/15 to-primary/5 text-primary",
    warn: "from-amber-500/15 to-amber-500/5 text-amber-600",
    good: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    muted: "from-muted to-transparent text-muted-foreground",
  };
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${tones[tone]} p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState({ users: 0, newUsers7d: 0, activeUsers7d: 0, lessons: 0, pendingReports: 0, newFeedback: 0, mods: 0 });
  const [growth, setGrowth] = useState<{ day: string; users: number; lessons: number }[]>([]);
  const [activity, setActivity] = useState<{ type: string; text: string; when: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since7 = subDays(new Date(), 7).toISOString();

    const [u, nu, l, pr, nf, ms, recentLessons, recentComments, recentReports, recentFeedback, growthUsers, growthLessons, activeUsers] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since7),
      supabase.from("lessons").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).in("role", ["moderator", "admin"]),
      supabase.from("lessons").select("id, title, created_at, author_id").order("created_at", { ascending: false }).limit(5),
      supabase.from("comments").select("id, body, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("reports").select("id, reason, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("feedback").select("id, subject, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("profiles").select("created_at").gte("created_at", since7),
      supabase.from("lessons").select("created_at").gte("created_at", since7),
      supabase.from("lessons").select("author_id").gte("created_at", since7),
    ]);

    const days: Record<string, { users: number; lessons: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      days[d] = { users: 0, lessons: 0 };
    }
    (growthUsers.data ?? []).forEach((r) => {
      const k = format(startOfDay(new Date(r.created_at)), "MMM d");
      if (days[k]) days[k].users++;
    });
    (growthLessons.data ?? []).forEach((r) => {
      const k = format(startOfDay(new Date(r.created_at)), "MMM d");
      if (days[k]) days[k].lessons++;
    });
    setGrowth(Object.entries(days).map(([day, v]) => ({ day, ...v })));

    const activeIds = new Set((activeUsers.data ?? []).map((a) => a.author_id));

    setStats({
      users: u.count ?? 0,
      newUsers7d: nu.count ?? 0,
      activeUsers7d: activeIds.size,
      lessons: l.count ?? 0,
      pendingReports: pr.count ?? 0,
      newFeedback: nf.count ?? 0,
      mods: ms.count ?? 0,
    });

    const acts: { type: string; text: string; when: string }[] = [];
    (recentLessons.data ?? []).forEach((r) => acts.push({ type: "lesson", text: `New lesson: ${r.title}`, when: r.created_at }));
    (recentComments.data ?? []).forEach((r) => acts.push({ type: "comment", text: `Comment: ${r.body.slice(0, 60)}`, when: r.created_at }));
    (recentReports.data ?? []).forEach((r) => acts.push({ type: "report", text: `Report: ${r.reason.slice(0, 60)}`, when: r.created_at }));
    (recentFeedback.data ?? []).forEach((r) => acts.push({ type: "feedback", text: `Feedback: ${r.subject}`, when: r.created_at }));
    acts.sort((a, b) => +new Date(b.when) - +new Date(a.when));
    setActivity(acts.slice(0, 12));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      {(stats.pendingReports > 0 || stats.newFeedback > 0) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div className="text-sm">
            <span className="font-semibold">Action needed:</span>{" "}
            {stats.pendingReports > 0 && <>{stats.pendingReports} pending report(s)</>}
            {stats.pendingReports > 0 && stats.newFeedback > 0 && <> · </>}
            {stats.newFeedback > 0 && <>{stats.newFeedback} new feedback</>}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={stats.users} hint={`${stats.newUsers7d} new in 7d`} />
        <StatCard icon={Activity} label="Active (7d)" value={stats.activeUsers7d} hint="Posted lessons" tone="good" />
        <StatCard icon={BookOpen} label="Total lessons" value={stats.lessons} />
        <StatCard icon={Shield} label="Moderators" value={stats.mods} tone="muted" />
        <StatCard icon={Flag} label="Pending reports" value={stats.pendingReports} tone="warn" />
        <StatCard icon={MessageSquareWarning} label="Open feedback" value={stats.newFeedback} tone="warn" />
        <StatCard icon={Sparkles} label="New signups" value={stats.newUsers7d} hint="Last 7 days" tone="good" />
        <StatCard icon={TrendingUp} label="Growth rate" value={`${stats.users ? Math.round((stats.newUsers7d / stats.users) * 100) : 0}%`} hint="7d / total" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Growth — last 7 days</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(16 185 129)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="rgb(16 185 129)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#gu)" name="New users" />
                <Area type="monotone" dataKey="lessons" stroke="rgb(16 185 129)" fill="url(#gl)" name="New lessons" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Recent activity</h3>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {activity.map((a, i) => (
              <li key={i} className="text-xs border-b border-border pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] uppercase">{a.type}</Badge>
                  <span className="text-muted-foreground">{formatDistanceToNow(new Date(a.when), { addSuffix: true })}</span>
                </div>
                <p className="mt-1 line-clamp-2">{a.text}</p>
              </li>
            ))}
            {activity.length === 0 && <li className="text-xs text-muted-foreground">No recent activity.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Users ─────────────────────────────
interface UserRow {
  id: string; username: string; display_name: string | null; avatar_url: string | null;
  points: number; lesson_count: number; created_at: string; account_type: string; roles: string[];
}

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("profiles")
      .select("id, username, display_name, avatar_url, points, lesson_count, created_at, account_type")
      .order("created_at", { ascending: false }).limit(100);
    if (search.trim()) q = q.ilike("username", `%${search.trim()}%`);
    if (accountFilter !== "all") q = q.eq("account_type", accountFilter);
    const { data: profs } = await q;
    const ids = (profs ?? []).map((p) => p.id);
    const rolesMap = new Map<string, string[]>();
    if (ids.length) {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      (roles ?? []).forEach((r) => {
        const list = rolesMap.get(r.user_id) ?? [];
        list.push(r.role); rolesMap.set(r.user_id, list);
      });
    }
    setUsers((profs ?? []).map((p) => ({ ...p, roles: rolesMap.get(p.id) ?? ["user"] })) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, accountFilter]);

  const toggleRole = async (u: UserRow, role: "moderator" | "admin", has: boolean) => {
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", role);
      if (error) return toast.error(error.message);
      await logAdminAction("role_removed", "user", u.id, { role, username: u.username });
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role });
      if (error) return toast.error(error.message);
      await logAdminAction("role_added", "user", u.id, { role, username: u.username });
    }
    toast.success("Role updated"); void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search by username…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="teacher">Teachers</SelectItem>
            <SelectItem value="administrator">Administrators</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{users.length} users</span>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-card">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-accent/30">
            <UserAvatar name={u.display_name ?? u.username} url={u.avatar_url} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setSelected(u)} className="font-semibold hover:text-primary truncate text-left">
                  {u.display_name ?? u.username}
                </button>
                <span className="text-xs text-muted-foreground font-mono">@{u.username}</span>
                <Badge variant="outline" className="text-[10px]">{u.account_type}</Badge>
                {u.roles.filter((r) => r !== "user").map((r) => (
                  <Badge key={r} variant="secondary" className="text-[10px] uppercase">{r}</Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {u.points} pts · {u.lesson_count} lessons · joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(u)}>View</Button>
            {isAdmin && (
              <>
                <Button size="sm" variant={u.roles.includes("moderator") ? "secondary" : "outline"}
                  onClick={() => toggleRole(u, "moderator", u.roles.includes("moderator"))}>
                  {u.roles.includes("moderator") ? "Unmod" : "Mod"}
                </Button>
                <Button size="sm" variant={u.roles.includes("admin") ? "secondary" : "outline"}
                  onClick={() => toggleRole(u, "admin", u.roles.includes("admin"))}>
                  {u.roles.includes("admin") ? "Unadmin" : "Admin"}
                </Button>
              </>
            )}
          </div>
        ))}
        {!loading && users.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No users found.</div>}
      </div>

      <UserDetailDialog user={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function UserDetailDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const [data, setData] = useState<{ lessons: number; comments: number; rewards: { points: number; reason: string; created_at: string }[]; feedback: number } | null>(null);

  useEffect(() => {
    if (!user) { setData(null); return; }
    (async () => {
      const [l, c, r, f] = await Promise.all([
        supabase.from("lessons").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("rewards_log").select("points, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setData({ lessons: l.count ?? 0, comments: c.count ?? 0, rewards: r.data ?? [], feedback: f.count ?? 0 });
    })();
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>User profile</DialogTitle></DialogHeader>
        {user && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={user.display_name ?? user.username} url={user.avatar_url} size="lg" />
              <div>
                <div className="font-semibold">{user.display_name ?? user.username}</div>
                <div className="text-xs text-muted-foreground font-mono">@{user.username}</div>
                <div className="text-xs text-muted-foreground">Account: {user.account_type} · Joined {format(new Date(user.created_at), "PPP")}</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="rounded-lg border border-border p-3"><div className="text-xl font-semibold">{user.points}</div><div className="text-xs text-muted-foreground">Points</div></div>
              <div className="rounded-lg border border-border p-3"><div className="text-xl font-semibold">{data?.lessons ?? "—"}</div><div className="text-xs text-muted-foreground">Lessons</div></div>
              <div className="rounded-lg border border-border p-3"><div className="text-xl font-semibold">{data?.comments ?? "—"}</div><div className="text-xs text-muted-foreground">Comments</div></div>
              <div className="rounded-lg border border-border p-3"><div className="text-xl font-semibold">{data?.feedback ?? "—"}</div><div className="text-xs text-muted-foreground">Feedback</div></div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Recent rewards</div>
              <ul className="space-y-1 text-xs max-h-40 overflow-y-auto">
                {(data?.rewards ?? []).map((r, i) => (
                  <li key={i} className="flex justify-between border-b border-border py-1">
                    <span>{r.reason}</span>
                    <span className="text-primary font-mono">+{r.points}</span>
                  </li>
                ))}
                {data && data.rewards.length === 0 && <li className="text-muted-foreground">No rewards yet.</li>}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/u/$username" params={{ username: user.username }}>View public profile</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/messages/$username" params={{ username: user.username }}>Message</Link></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Lessons ─────────────────────────────
interface LessonRow {
  id: string; title: string; slug: string; author_id: string; like_count: number;
  fork_count: number; comment_count: number; is_published: boolean; created_at: string;
  author?: { username: string; display_name: string | null } | null;
}

function LessonsTab() {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("lessons")
      .select("id, title, slug, author_id, like_count, fork_count, comment_count, is_published, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
    if (statusFilter === "published") q = q.eq("is_published", true);
    if (statusFilter === "draft") q = q.eq("is_published", false);
    const { data: ls } = await q;
    const ids = Array.from(new Set((ls ?? []).map((l) => l.author_id)));
    const map = new Map<string, { username: string; display_name: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name").in("id", ids);
      (profs ?? []).forEach((p) => map.set(p.id, { username: p.username, display_name: p.display_name }));
    }
    setLessons((ls ?? []).map((l) => ({ ...l, author: map.get(l.author_id) ?? null })) as LessonRow[]);
    setLoading(false);
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, statusFilter]);

  const remove = async (l: LessonRow) => {
    if (!confirm(`Delete "${l.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("lessons").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    await logAdminAction("lesson_deleted", "lesson", l.id, { title: l.title });
    toast.success("Lesson removed"); void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search title…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{lessons.length} lessons</span>
      </div>
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-card">
        {lessons.map((l) => (
          <div key={l.id} className="flex items-center gap-3 p-3 hover:bg-accent/30">
            <div className="flex-1 min-w-0">
              <Link to="/lessons/$lessonId" params={{ lessonId: l.id }} className="font-semibold hover:text-primary block truncate">
                {l.title}
              </Link>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                {l.author && <span>by @{l.author.username}</span>}
                <span>· {l.like_count} likes</span>
                <span>· {l.fork_count} forks</span>
                <span>· {l.comment_count} comments</span>
                <span>· {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</span>
                {!l.is_published && <Badge variant="outline" className="text-[10px]">draft</Badge>}
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => remove(l)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        ))}
        {!loading && lessons.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No lessons.</div>}
      </div>
    </div>
  );
}

// ───────────────────────────── Reports ─────────────────────────────
interface ReportRow {
  id: string; reported_by: string; target_id: string; target_type: ReportTargetType;
  reason: string; status: ReportStatus; resolution_note: string | null; resolved_by: string | null; created_at: string;
  reporter?: { username: string; display_name: string | null; avatar_url: string | null } | null;
  preview?: string | null;
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
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", reporterIds);
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

    setReports(rows); setLoading(false);
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
    const { error } = await supabase.from("reports").update({ status, resolution_note: note || null, resolved_by: user?.id ?? null }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await logAdminAction("report_resolved", "report", r.id, { status, removed: removeContent });
    toast.success(`Report ${status}`); void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Pending</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
      </div>
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && reports.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
          No reports {filter === "pending" ? "awaiting review" : "found"}.
        </div>
      )}
      {reports.map((r) => (
        <div key={r.id} className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono uppercase text-[10px]">{r.target_type}</Badge>
              <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
            </div>
            {r.reporter && (
              <Link to="/u/$username" params={{ username: r.reporter.username }} className="flex items-center gap-2 text-xs hover:opacity-80">
                <UserAvatar name={r.reporter.display_name ?? r.reporter.username} url={r.reporter.avatar_url} size="sm" />
                <span>@{r.reporter.username}</span>
              </Link>
            )}
          </div>
          <div className="mt-3 text-sm">
            <div className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Reason</div>
            <p className="text-muted-foreground whitespace-pre-wrap mt-1">{r.reason}</p>
          </div>
          {r.preview && (
            <div className="mt-3 p-3 rounded border border-border bg-background text-sm">
              <div className="text-xs text-muted-foreground mb-1">Reported content</div>
              <div className="break-words">{r.preview}</div>
              {r.target_type === "lesson" && (
                <Link to="/lessons/$lessonId" params={{ lessonId: r.target_id }} className="text-xs text-primary hover:underline mt-2 inline-block">View lesson →</Link>
              )}
            </div>
          )}
          {r.resolution_note && r.status !== "pending" && (
            <div className="mt-3 text-xs text-muted-foreground"><span className="font-semibold">Resolution: </span>{r.resolution_note}</div>
          )}
          {r.status === "pending" && (
            <div className="mt-3 space-y-2">
              <Textarea placeholder="Resolution note (optional)" value={noteDraft[r.id] ?? ""}
                onChange={(e) => setNoteDraft((p) => ({ ...p, [r.id]: e.target.value }))} rows={2} className="text-sm" />
              <div className="flex flex-wrap gap-2">
                {(r.target_type === "lesson" || r.target_type === "comment" || r.target_type === "chat_message") && (
                  <Button size="sm" variant="destructive" onClick={() => resolve(r, "resolved", true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove & resolve
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => resolve(r, "resolved", false)}><CheckCircle className="h-3.5 w-3.5" /> Resolve</Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(r, "dismissed", false)}><XCircle className="h-3.5 w-3.5" /> Dismiss</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Feedback ─────────────────────────────
interface FeedbackRow {
  id: string; user_id: string | null; subject: string; body: string; category: string;
  rating: number | null; status: string; priority: boolean; admin_notes: string | null;
  response: string | null; responded_at: string | null; created_at: string;
  user?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

function FeedbackTab() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [selected, setSelected] = useState<FeedbackRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(200);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
    if (ratingFilter !== "all") q = q.eq("rating", parseInt(ratingFilter));
    if (search.trim()) q = q.ilike("subject", `%${search.trim()}%`);
    const { data } = await q;
    const rows = (data ?? []) as FeedbackRow[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => { if (r.user_id) r.user = map.get(r.user_id) ?? null; });
    }
    setItems(rows); setLoading(false);
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, statusFilter, categoryFilter, ratingFilter]);

  const updateItem = async (id: string, patch: FeedbackPatch) => {
    const { error } = await supabase.from("feedback").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction("feedback_updated", "feedback", id, patch as Record<string, unknown>);
    toast.success("Updated"); void load();
    if (selected?.id === id) setSelected({ ...selected, ...patch });
  };

  const stats = useMemo(() => {
    const total = items.length;
    const avgRating = items.filter((i) => i.rating).reduce((s, i) => s + (i.rating ?? 0), 0) / (items.filter((i) => i.rating).length || 1);
    const byStatus = items.reduce((acc, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    return { total, avgRating, byStatus };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={MessageSquareWarning} label="Total" value={stats.total} />
        <StatCard icon={AlertTriangle} label="Open" value={stats.byStatus.open ?? 0} tone="warn" />
        <StatCard icon={Activity} label="In review" value={stats.byStatus.in_review ?? 0} />
        <StatCard icon={Star} label="Avg rating" value={stats.avgRating ? stats.avgRating.toFixed(1) : "—"} tone="good" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="open">New / Open</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="suggestion">Suggestion</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="praise">Praise</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} star{n > 1 ? "s" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{items.length} items</span>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Subject</th>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Rating</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((f) => (
              <tr key={f.id} className="hover:bg-accent/20">
                <td className="p-3">
                  {f.user ? (
                    <Link to="/u/$username" params={{ username: f.user.username }} className="flex items-center gap-2 hover:text-primary">
                      <UserAvatar name={f.user.display_name ?? f.user.username} url={f.user.avatar_url} size="sm" />
                      <span className="text-xs">@{f.user.username}</span>
                    </Link>
                  ) : <span className="text-xs text-muted-foreground">Anonymous</span>}
                </td>
                <td className="p-3">
                  <button onClick={() => setSelected(f)} className="text-left hover:text-primary">
                    <span className="font-medium flex items-center gap-1">
                      {f.priority && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                      {f.subject}
                    </span>
                  </button>
                </td>
                <td className="p-3"><Badge variant="outline" className="text-[10px] capitalize">{f.category}</Badge></td>
                <td className="p-3 text-xs">{f.rating ? `${f.rating}★` : "—"}</td>
                <td className="p-3"><Badge className={STATUS_COLORS[f.status] ?? ""}>{f.status}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</td>
                <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setSelected(f)}>Open</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No feedback found.</div>}
      </div>

      <FeedbackDialog item={selected} onClose={() => setSelected(null)} onUpdate={updateItem} />
    </div>
  );
}

function FeedbackDialog({ item, onClose, onUpdate }: { item: FeedbackRow | null; onClose: () => void; onUpdate: (id: string, patch: FeedbackPatch) => void }) {
  const [notes, setNotes] = useState("");
  const [response, setResponse] = useState("");

  useEffect(() => {
    if (item) { setNotes(item.admin_notes ?? ""); setResponse(item.response ?? ""); }
  }, [item]);

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.priority && <Star className="h-4 w-4 fill-amber-500 text-amber-500" />}
            {item.subject}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="capitalize">{item.category}</Badge>
            <Badge className={STATUS_COLORS[item.status]}>{item.status}</Badge>
            {item.rating && <Badge variant="outline">{item.rating}★</Badge>}
            <span className="text-muted-foreground">{format(new Date(item.created_at), "PPP p")}</span>
          </div>
          {item.user && (
            <div className="text-sm">
              From <Link to="/u/$username" params={{ username: item.user.username }} className="text-primary hover:underline">@{item.user.username}</Link>
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{item.body}</div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={item.status} onValueChange={(v) => onUpdate(item.id, { status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">New / Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Button variant={item.priority ? "default" : "outline"} onClick={() => onUpdate(item.id, { priority: !item.priority })}>
              <Star className="h-4 w-4" /> {item.priority ? "Remove priority" : "Mark priority"}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Internal notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes for the team only" />
            <Button size="sm" variant="outline" onClick={() => onUpdate(item.id, { admin_notes: notes })}>Save notes</Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Response to user</label>
            <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} placeholder="Public response visible to the user" />
            <Button size="sm" onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              onUpdate(item.id, { response, responded_at: new Date().toISOString(), responded_by: user?.id } as FeedbackPatch);
            }}>Save response</Button>
            {item.responded_at && <p className="text-xs text-muted-foreground">Last responded {format(new Date(item.responded_at), "PPP p")}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Announcements ─────────────────────────────
interface Announcement { id: string; author_id: string; title: string; body: string; audience: string; created_at: string; }

function AnnouncementsTab() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
    setItems((data ?? []) as Announcement[]); setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!title.trim() || !body.trim() || !user) return;
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim(), audience, author_id: user.id });
    if (error) return toast.error(error.message);
    await logAdminAction("announcement_created", "announcement", undefined, { title, audience });
    toast.success("Announcement posted"); setTitle(""); setBody(""); void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction("announcement_deleted", "announcement", id);
    toast.success("Removed"); void load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 h-fit">
        <h3 className="font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4" /> Broadcast</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        <Textarea placeholder="Message…" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={2000} />
        <Select value={audience} onValueChange={setAudience}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="teacher">Teachers</SelectItem>
            <SelectItem value="administrator">Administrators</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={create} disabled={!title.trim() || !body.trim()} className="w-full">Post announcement</Button>
      </div>
      <div className="space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {items.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold">{a.title}</h4>
                <div className="text-xs text-muted-foreground">{format(new Date(a.created_at), "PPP p")} · {a.audience}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap">{a.body}</p>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="text-sm text-muted-foreground">No announcements yet.</div>}
      </div>
    </div>
  );
}

// ───────────────────────────── Analytics ─────────────────────────────
function AnalyticsTab() {
  const [range, setRange] = useState("30");
  const [series, setSeries] = useState<{ day: string; users: number; lessons: number; comments: number }[]>([]);
  const [feedbackByCat, setFeedbackByCat] = useState<{ name: string; value: number }[]>([]);
  const [ratingTrend, setRatingTrend] = useState<{ day: string; avg: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const days = parseInt(range);
    const since = subDays(new Date(), days).toISOString();
    const [users, lessons, comments, feedback] = await Promise.all([
      supabase.from("profiles").select("created_at").gte("created_at", since),
      supabase.from("lessons").select("created_at").gte("created_at", since),
      supabase.from("comments").select("created_at").gte("created_at", since),
      supabase.from("feedback").select("category, rating, created_at").gte("created_at", since),
    ]);

    const buckets: Record<string, { day: string; users: number; lessons: number; comments: number }> = {};
    const ratingBuckets: Record<string, { sum: number; count: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const k = format(subDays(new Date(), i), "MMM d");
      buckets[k] = { day: k, users: 0, lessons: 0, comments: 0 };
      ratingBuckets[k] = { sum: 0, count: 0 };
    }
    (users.data ?? []).forEach((r) => { const k = format(startOfDay(new Date(r.created_at)), "MMM d"); if (buckets[k]) buckets[k].users++; });
    (lessons.data ?? []).forEach((r) => { const k = format(startOfDay(new Date(r.created_at)), "MMM d"); if (buckets[k]) buckets[k].lessons++; });
    (comments.data ?? []).forEach((r) => { const k = format(startOfDay(new Date(r.created_at)), "MMM d"); if (buckets[k]) buckets[k].comments++; });

    const catCounts: Record<string, number> = {};
    (feedback.data ?? []).forEach((f) => {
      catCounts[f.category] = (catCounts[f.category] ?? 0) + 1;
      if (f.rating) {
        const k = format(startOfDay(new Date(f.created_at)), "MMM d");
        if (ratingBuckets[k]) { ratingBuckets[k].sum += f.rating; ratingBuckets[k].count++; }
      }
    });

    setSeries(Object.values(buckets));
    setFeedbackByCat(Object.entries(catCounts).map(([name, value]) => ({ name, value })));
    setRatingTrend(Object.entries(ratingBuckets).map(([day, v]) => ({ day, avg: v.count ? +(v.sum / v.count).toFixed(2) : 0 })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [range]);

  const COLORS = ["hsl(var(--primary))", "rgb(16 185 129)", "rgb(245 158 11)", "rgb(239 68 68)", "rgb(139 92 246)", "rgb(14 165 233)"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Date range:</span>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading analytics…</div> : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Activity over time</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="users" fill="hsl(var(--primary))" name="New users" />
                  <Bar dataKey="lessons" fill="rgb(16 185 129)" name="Lessons" />
                  <Bar dataKey="comments" fill="rgb(245 158 11)" name="Comments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-4">Feedback by category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={feedbackByCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                      {feedbackByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-4">Average rating trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ratingTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" fontSize={10} />
                    <YAxis domain={[0, 5]} fontSize={11} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avg" stroke="rgb(245 158 11)" fill="rgb(245 158 11 / 0.2)" name="Avg rating" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────────── Logs ─────────────────────────────
interface LogRow { id: string; admin_id: string; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown>; created_at: string; admin?: { username: string } | null; }

function LogsTab() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = (data ?? []) as LogRow[];
    const ids = Array.from(new Set(rows.map((r) => r.admin_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => { r.admin = map.get(r.admin_id) ?? null; });
    }
    setLogs(rows); setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Audit trail of administrator actions.</p>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Admin</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Target</th>
              <th className="text-left p-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-accent/20">
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</td>
                <td className="p-3 text-xs">@{l.admin?.username ?? "—"}</td>
                <td className="p-3"><Badge variant="outline" className="text-[10px]">{l.action}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{l.target_type ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground font-mono truncate max-w-md">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && logs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No admin actions logged yet.</div>}
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
      </div>
    </div>
  );
}
