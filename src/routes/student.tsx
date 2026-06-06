import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, BookOpen, Users, DollarSign, Search, CalendarPlus, Upload, MessageSquare, Star, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Dashboard — Leatha" }] }),
  component: () => (<RequireAuth><StudentDashboard /></RequireAuth>),
});

function StudentDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ upcoming: 0, completed: 0, hired: 0, spent: 0 });
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const nowIso = new Date().toISOString();
      const [u, c, all, d, t] = await Promise.all([
        (supabase as any).from("appointments").select("id,subject,starts_at,ends_at,status,teacher:profiles!appointments_teacher_id_fkey(username,display_name,avatar_url)").eq("student_id", user.id).gte("starts_at", nowIso).order("starts_at").limit(5),
        (supabase as any).from("appointments").select("id", { count: "exact", head: true }).eq("student_id", user.id).eq("status", "completed"),
        (supabase as any).from("appointments").select("teacher_id,price_cents,status").eq("student_id", user.id),
        (supabase as any).from("documents").select("id,title,file_type,file_size_bytes,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(3),
        (supabase as any).from("teacher_profiles").select("user_id,subjects,rating_avg,rating_count,profile:profiles!teacher_profiles_user_id_fkey(username,display_name,avatar_url)").order("rating_avg", { ascending: false }).limit(3),
      ]);
      const allRows = (all.data ?? []) as { teacher_id: string; price_cents: number; status: string }[];
      const spent = allRows.filter(r => r.status === "completed").reduce((s, r) => s + r.price_cents, 0);
      const hired = new Set(allRows.map(r => r.teacher_id)).size;
      setStats({ upcoming: u.data?.length ?? 0, completed: c.count ?? 0, hired, spent });
      setUpcoming(u.data ?? []); setDocs(d.data ?? []); setTeachers(t.data ?? []);
    })();
  }, [user]);

  if (!user || !profile) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back, {profile.display_name ?? profile.username}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Users} tint="blue" label="My Appointments" value={stats.upcoming} sub="Upcoming" />
        <StatTile icon={BookOpen} tint="emerald" label="Completed Sessions" value={stats.completed} sub="All time" />
        <StatTile icon={CalendarDays} tint="violet" label="Teachers Hired" value={stats.hired} sub="All Time" />
        <StatTile icon={DollarSign} tint="amber" label="Total Spent" value={`$${(stats.spent/100).toFixed(0)}`} sub="All Time" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Upcoming Appointments" actionLabel="View All" actionTo="/appointments">
          {upcoming.length === 0 ? <Empty text="No upcoming sessions." /> : (
            <ul className="divide-y divide-border">
              {upcoming.map((a) => (
                <li key={a.id} className="py-3 flex items-center gap-3">
                  <UserAvatar name={a.teacher?.display_name ?? a.teacher?.username} url={a.teacher?.avatar_url ?? null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.teacher?.display_name ?? a.teacher?.username}</div>
                    <div className="text-xs text-muted-foreground">{a.subject}</div>
                  </div>
                  <div className="hidden sm:block text-right text-xs font-mono text-muted-foreground">
                    <div>{format(new Date(a.starts_at), "d MMM yyyy")}</div>
                    <div>{format(new Date(a.starts_at), "h:mm a")} – {format(new Date(a.ends_at), "h:mm a")}</div>
                  </div>
                  <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-blue-500/10 text-blue-600 capitalize">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quick Actions">
          <div className="grid grid-cols-2 gap-3">
            <QuickAction to="/find-teachers" icon={Search} tint="blue" title="Find Teachers" sub="Browse & hire teachers" />
            <QuickAction to="/appointments" icon={CalendarPlus} tint="emerald" title="Book Appointment" sub="Schedule a session" />
            <QuickAction to="/documents" icon={Upload} tint="violet" title="Upload Document" sub="Upload notes (Word/PDF)" />
            <QuickAction to="/messages" icon={MessageSquare} tint="amber" title="Messages" sub="Chat with teachers" />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Recent Documents" actionLabel="View All" actionTo="/documents">
          {docs.length === 0 ? <Empty text="No documents yet." /> : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="py-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-rose-500/10 text-rose-600 grid place-items-center"><FileText className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">Uploaded {format(new Date(d.created_at), "d MMM yyyy")}</div></div>
                  <div className="text-xs font-mono text-muted-foreground">{(d.file_size_bytes/1024/1024).toFixed(1)} MB</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Top Teachers" actionLabel="View All" actionTo="/find-teachers">
          {teachers.length === 0 ? <Empty text="No teachers yet." /> : (
            <ul className="divide-y divide-border">
              {teachers.map((t) => (
                <li key={t.user_id} className="py-3 flex items-center gap-3">
                  <UserAvatar name={t.profile?.display_name ?? t.profile?.username} url={t.profile?.avatar_url ?? null} size="sm" />
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{t.profile?.display_name ?? t.profile?.username}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.subjects.slice(0,2).join(", ")}</div></div>
                  <div className="flex items-center gap-1 text-sm"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /><span className="font-semibold">{Number(t.rating_avg).toFixed(1)}</span><span className="text-muted-foreground text-xs">({t.rating_count})</span></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

const TINT: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600", emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600", amber: "bg-amber-500/10 text-amber-600",
};
function StatTile({ icon: Icon, tint, label, value, sub }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className={`h-11 w-11 rounded-xl grid place-items-center ${TINT[tint]}`}><Icon className="h-5 w-5" /></div>
        <div className="flex-1"><div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-display font-bold mt-1">{value}</div>
          <div className="text-xs text-primary mt-0.5">{sub}</div></div>
      </div>
    </div>
  );
}
function Panel({ title, actionLabel, actionTo, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold">{title}</h2>
        {actionLabel && <Link to={actionTo} className="text-xs text-primary hover:underline">{actionLabel}</Link>}
      </div>
      {children}
    </div>
  );
}
function QuickAction({ to, icon: Icon, tint, title, sub }: any) {
  return (
    <Link to={to} className={`rounded-xl p-4 flex items-start gap-3 ${TINT[tint]} hover:opacity-90 transition-opacity`}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div><div className="font-semibold text-sm">{title}</div><div className="text-xs opacity-80">{sub}</div></div>
    </Link>
  );
}
function Empty({ text }: { text: string }) { return <div className="text-sm text-muted-foreground py-6 text-center">{text}</div>; }
