import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { StatCard } from "@/components/dashboards/stat-card";
import {
  CalendarDays,
  BookOpen,
  Users,
  Flame,
  Search,
  CalendarPlus,
  Upload,
  MessageSquare,
  FileText,
  Star,
  HelpCircle,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { format } from "date-fns";

interface Appointment {
  id: string;
  subject: string;
  starts_at: string;
  status: string;
  teacher_id: string;
  teacher?: { display_name: string | null; username: string; avatar_url: string | null };
}

interface DocRow {
  id: string;
  title: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
}

interface TopTeacher {
  user_id: string;
  subjects: string[];
  rating_avg: number;
  rating_count: number;
  hourly_rate: number;
  profile?: { display_name: string | null; username: string; avatar_url: string | null };
}

export function StudentDashboardContent() {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [teachersHired, setTeachersHired] = useState(0);
  const [streak, setStreak] = useState(0);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [topTeachers, setTopTeachers] = useState<TopTeacher[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const [{ data: appts }, { data: completed }, { data: docRows }, { data: teachers }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id, subject, starts_at, status, teacher_id")
            .eq("student_id", user.id)
            .in("status", ["pending", "confirmed"])
            .order("starts_at", { ascending: true })
            .limit(5),
          supabase
            .from("appointments")
            .select("teacher_id, status")
            .eq("student_id", user.id)
            .eq("status", "completed"),
          supabase
            .from("documents")
            .select("id, title, file_type, file_size_bytes, created_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("teacher_profiles")
            .select("user_id, subjects, rating_avg, rating_count, hourly_rate")
            .order("rating_avg", { ascending: false })
            .limit(3),
        ]);

      if (cancelled) return;

      const teacherIds = [...new Set((appts ?? []).map((a) => a.teacher_id))];
      let profilesById: Record<string, any> = {};
      if (teacherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", teacherIds);
        profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      }
      setAppointments(
        (appts ?? []).map((a) => ({ ...a, teacher: profilesById[a.teacher_id] })) as Appointment[],
      );

      setCompletedCount((completed ?? []).length);
      setTeachersHired(new Set((completed ?? []).map((c) => c.teacher_id)).size);
      setDocs((docRows ?? []) as DocRow[]);

      const topIds = (teachers ?? []).map((t) => t.user_id);
      let topProfiles: Record<string, any> = {};
      if (topIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", topIds);
        topProfiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      }
      setTopTeachers(
        (teachers ?? []).map((t) => ({ ...t, profile: topProfiles[t.user_id] })) as TopTeacher[],
      );

      const { data: events } = await supabase
        .from("analytics_events")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (events && events.length) {
        const days = new Set(events.map((e) => format(new Date(e.created_at), "yyyy-MM-dd")));
        let s = 0;
        let d = new Date();
        while (days.has(format(d, "yyyy-MM-dd"))) {
          s++;
          d.setDate(d.getDate() - 1);
        }
        setStreak(s);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Welcome back, {profile?.display_name ?? profile?.username}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening with your learning today.
          </p>
        </div>
        <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
          <UserAvatar
            name={profile?.display_name ?? profile?.username}
            url={profile?.avatar_url}
            size="md"
          />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<CalendarDays className="h-5 w-5 text-primary" />}
          label="My Appointments"
          value={appointments.length}
          sub="Upcoming"
          color="bg-primary/10"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-green-500" />}
          label="Completed Sessions"
          value={completedCount}
          sub="All time"
          color="bg-green-500/10"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-purple-500" />}
          label="Teachers Hired"
          value={teachersHired}
          sub="All time"
          color="bg-purple-500/10"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-amber-500" />}
          label="Learning Streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          sub={streak > 0 ? "Keep it going!" : "Start today"}
          color="bg-amber-500/10"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Upcoming Appointments</h2>
              <Link to="/appointments" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No upcoming appointments.{" "}
                <Link to="/find-teachers" className="text-primary hover:underline">
                  Find a teacher
                </Link>
              </p>
            ) : (
              <div className="space-y-1">
                {appointments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <UserAvatar
                      name={a.teacher?.display_name ?? a.teacher?.username ?? "T"}
                      url={a.teacher?.avatar_url}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.teacher?.display_name ?? a.teacher?.username}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.subject}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(a.starts_at), "MMM d, h:mm a")}
                      </p>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block",
                          a.status === "confirmed"
                            ? "bg-green-500/15 text-green-500"
                            : "bg-amber-500/15 text-amber-500",
                        )}
                      >
                        {a.status === "confirmed" ? "Confirmed" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Documents</h2>
              <Link to="/documents" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No documents yet.</p>
            ) : (
              <div className="space-y-1">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(d.created_at)} · {(d.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/find-teachers"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Search className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-semibold">Find Teachers</p>
                <p className="text-[11px] text-muted-foreground">Browse & hire</p>
              </Link>
              <Link
                to="/appointments"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
                  <CalendarPlus className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-xs font-semibold">Book Appointment</p>
                <p className="text-[11px] text-muted-foreground">Schedule a session</p>
              </Link>
              <Link
                to="/documents"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
                  <Upload className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xs font-semibold">Upload Document</p>
                <p className="text-[11px] text-muted-foreground">Share notes</p>
              </Link>
              <Link
                to="/messages"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-xs font-semibold">Messages</p>
                <p className="text-[11px] text-muted-foreground">Chat with teachers</p>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Top Teachers</h2>
              <Link to="/find-teachers" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {topTeachers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No teachers available yet.
              </p>
            ) : (
              <div className="space-y-1">
                {topTeachers.map((t) => (
                  <div
                    key={t.user_id}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <UserAvatar
                      name={t.profile?.display_name ?? t.profile?.username ?? "T"}
                      url={t.profile?.avatar_url}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.profile?.display_name ?? t.profile?.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(t.subjects ?? []).slice(0, 2).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-amber-500 flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-500" />
                        {t.rating_avg?.toFixed(1) ?? "0.0"} ({t.rating_count})
                      </span>
                      <Link
                        to="/find-teachers"
                        className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary"
                      >
                        Hire
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/help"
            className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:bg-accent transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Help & Support</p>
              <p className="text-xs text-muted-foreground">Get help using Leatha</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}