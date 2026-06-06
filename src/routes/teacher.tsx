import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Users, DollarSign, Star, Upload, CalendarPlus, BookOpen, MessageSquare, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher Dashboard — Leatha" }] }),
  component: () => (<RequireAuth><TeacherDashboard /></RequireAuth>),
});

const TINT: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600", emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600", amber: "bg-amber-500/10 text-amber-600",
};

function TeacherDashboard() {
  const { user, profile } = useAuth();
  const [tp, setTp] = useState<any>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      const [p, t, u, d, r] = await Promise.all([
        (supabase as any).from("teacher_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("appointments").select("id", { count: "exact", head: true }).eq("teacher_id", user.id).gte("starts_at", start.toISOString()).lte("starts_at", end.toISOString()),
        (supabase as any).from("appointments").select("id,subject,starts_at,ends_at,status,student:profiles!appointments_student_id_fkey(username,display_name,avatar_url)").eq("teacher_id", user.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
        (supabase as any).from("documents").select("id,title,file_type,file_size_bytes,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(3),
        (supabase as any).from("teacher_reviews").select("id,rating,comment,created_at,student:profiles!teacher_reviews_student_id_fkey(username,display_name,avatar_url)").eq("teacher_id", user.id).order("created_at", { ascending: false }).limit(3),
      ]);
      setTp(p.data); setTodayCount(t.count ?? 0); setUpcoming(u.data ?? []); setDocs(d.data ?? []); setReviews(r.data ?? []);
    })();
  }, [user]);

  if (!user || !profile) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold">Welcome back, {profile.display_name ?? profile.username}! 👋</h1>
          <p className="text-sm text-muted-foreground">Here's what's happening with your teaching today.</p>
        </div>
        <div className="text-sm font-mono rounded-xl border border-border bg-card px-4 py-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> {format(new Date(), "d MMM yyyy")}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={CalendarDays} tint="blue" label="Today's Sessions" value={todayCount} sub="View today's schedule" />
        <StatTile icon={Users} tint="emerald" label="Total Students" value={tp?.students_count ?? 0} sub="View all students" />
        <StatTile icon={DollarSign} tint="violet" label="Total Earnings" value={`$${((tp?.total_earnings_cents ?? 0)/100).toFixed(0)}`} sub="All time" />
        <StatTile icon={Star} tint="amber" label="Average Rating" value={Number(tp?.rating_avg ?? 0).toFixed(1)} sub={`(${tp?.rating_count ?? 0} reviews)`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Upcoming Appointments" actionLabel="View Calendar" actionTo="/appointments">
          {upcoming.length === 0 ? <Empty text="No upcoming sessions." /> : (
            <ul className="divide-y divide-border">
              {upcoming.map((a) => (
                <li key={a.id} className="py-3 flex items-center gap-3">
                  <UserAvatar name={a.student?.display_name ?? a.student?.username} url={a.student?.avatar_url ?? null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.student?.display_name ?? a.student?.username}</div>
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
            <QuickAction to="/documents" icon={Upload} tint="blue" title="Upload Document" sub="Upload study materials (Word / PDF)" />
            <QuickAction to="/teacher/availability" icon={CalendarPlus} tint="emerald" title="Add Availability" sub="Set your available time slots" />
            <QuickAction to="/appointments" icon={BookOpen} tint="violet" title="Manage Sessions" sub="View and manage your sessions" />
            <QuickAction to="/messages" icon={MessageSquare} tint="amber" title="Messages" sub="Chat with students and parents" />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Recent Documents" actionLabel="View all" actionTo="/documents">
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

        <Panel title="Recent Reviews" actionLabel="View all" actionTo="/teacher">
          {reviews.length === 0 ? <Empty text="No reviews yet." /> : (
            <ul className="divide-y divide-border">
              {reviews.map((r) => (
                <li key={r.id} className="py-3 flex gap-3">
                  <UserAvatar name={r.student?.display_name ?? r.student?.username} url={r.student?.avatar_url ?? null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">{r.student?.display_name ?? r.student?.username}</div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({length: r.rating}).map((_,i) => <Star key={i} className="h-3 w-3 fill-amber-500 text-amber-500" />)}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{r.comment}</p>}
                    <div className="text-xs text-muted-foreground font-mono mt-1">{format(new Date(r.created_at), "d MMM yyyy")}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

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
