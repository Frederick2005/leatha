import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { StatCard } from "@/components/dashboards/stat-card";
import {
  CalendarDays,
  Users,
  Coins,
  Star,
  Upload,
  CalendarPlus,
  CalendarCheck,
  MessageSquare,
  FileText,
  HelpCircle,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { format, isToday } from "date-fns";

interface Appointment {
  id: string;
  subject: string;
  starts_at: string;
  status: string;
  student_id: string;
  student?: { display_name: string | null; username: string; avatar_url: string | null };
}

interface DocRow {
  id: string;
  title: string;
  file_size_bytes: number;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  student_id: string;
  student?: { display_name: string | null; username: string; avatar_url: string | null };
}

export function TeacherDashboardContent() {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todaysCount, setTodaysCount] = useState(0);
  const [tProfile, setTProfile] = useState<{
    students_count: number;
    total_earnings: number;
    rating_avg: number;
    rating_count: number;
  } | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const [{ data: appts }, { data: tp }, { data: docRows }, { data: revRows }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id, subject, starts_at, status, student_id")
            .eq("teacher_id", user.id)
            .in("status", ["pending", "confirmed"])
            .order("starts_at", { ascending: true })
            .limit(5),
          supabase
            .from("teacher_profiles")
            .select("students_count, total_earnings, rating_avg, rating_count")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("documents")
            .select("id, title, file_size_bytes, created_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("teacher_reviews")
            .select("id, rating, comment, created_at, student_id")
            .eq("teacher_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

      if (cancelled) return;

      const studentIds = [
        ...new Set([
          ...(appts ?? []).map((a) => a.student_id),
          ...(revRows ?? []).map((r) => r.student_id),
        ]),
      ];
      let profilesById: Record<string, any> = {};
      if (studentIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", studentIds);
        profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      }

      setAppointments(
        (appts ?? []).map((a) => ({ ...a, student: profilesById[a.student_id] })) as Appointment[],
      );
      setTodaysCount((appts ?? []).filter((a) => isToday(new Date(a.starts_at))).length);
      setTProfile(tp ?? { students_count: 0, total_earnings: 0, rating_avg: 0, rating_count: 0 });
      setDocs((docRows ?? []) as DocRow[]);
      setReviews(
        (revRows ?? []).map((r) => ({ ...r, student: profilesById[r.student_id] })) as Review[],
      );
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
            Here's what's happening with your teaching today.
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
          label="Today's Sessions"
          value={todaysCount}
          sub="View schedule"
          color="bg-primary/10"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-green-500" />}
          label="Total Students"
          value={tProfile?.students_count ?? 0}
          sub="All time"
          color="bg-green-500/10"
        />
        <StatCard
          icon={<Coins className="h-5 w-5 text-purple-500" />}
          label="Total Earnings"
          value={`UGX ${((tProfile?.total_earnings ?? 0) / 100).toLocaleString()}`}
          sub="All time"
          color="bg-purple-500/10"
        />
        <StatCard
          icon={<Star className="h-5 w-5 text-amber-500" />}
          label="Average Rating"
          value={tProfile?.rating_avg?.toFixed(1) ?? "0.0"}
          sub={`${tProfile?.rating_count ?? 0} reviews`}
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
                No upcoming appointments.
              </p>
            ) : (
              <div className="space-y-1">
                {appointments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <UserAvatar
                      name={a.student?.display_name ?? a.student?.username ?? "S"}
                      url={a.student?.avatar_url}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.student?.display_name ?? a.student?.username}
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
                to="/documents"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Upload className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-semibold">Upload Document</p>
                <p className="text-[11px] text-muted-foreground">Share study materials</p>
              </Link>
              <Link
                to="/teacher/availability"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
                  <CalendarPlus className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-xs font-semibold">Add Availability</p>
                <p className="text-[11px] text-muted-foreground">Set your time slots</p>
              </Link>
              <Link
                to="/appointments"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
                  <CalendarCheck className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xs font-semibold">Manage Sessions</p>
                <p className="text-[11px] text-muted-foreground">View all sessions</p>
              </Link>
              <Link
                to="/messages"
                className="rounded-xl border border-border p-3 hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-xs font-semibold">Messages</p>
                <p className="text-[11px] text-muted-foreground">Chat with students</p>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Reviews</h2>
              <Link to="/teacher/reviews" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No reviews yet.</p>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => (
                  <div key={r.id} className="flex gap-3 py-2 border-b border-border last:border-0">
                    <UserAvatar
                      name={r.student?.display_name ?? r.student?.username ?? "S"}
                      url={r.student?.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {r.student?.display_name ?? r.student?.username}
                        </p>
                        <span className="text-amber-500 text-xs">
                          {"★".repeat(r.rating)}
                          {"☆".repeat(5 - r.rating)}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.comment}</p>
                      )}
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