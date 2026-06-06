import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, Clock, Plus, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/appointments")({
  head: () => ({ meta: [{ title: "Appointments — Leatha" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ teacher: typeof s.teacher === "string" ? s.teacher : undefined }),
  component: () => (<RequireAuth><AppointmentsPage /></RequireAuth>),
});

interface ApptRow {
  id: string; teacher_id: string; student_id: string; subject: string;
  starts_at: string; ends_at: string; status: string; price_cents: number; currency: string;
  teacher: { username: string; display_name: string | null; avatar_url: string | null } | null;
  student: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  confirmed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function AppointmentsPage() {
  const { user, profile } = useAuth();
  const search = Route.useSearch();
  const [appts, setAppts] = useState<ApptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("appointments")
      .select("id,teacher_id,student_id,subject,starts_at,ends_at,status,price_cents,currency,teacher:profiles!appointments_teacher_id_fkey(username,display_name,avatar_url),student:profiles!appointments_student_id_fkey(username,display_name,avatar_url)")
      .or(`teacher_id.eq.${user.id},student_id.eq.${user.id}`)
      .order("starts_at", { ascending: false });
    setAppts((data ?? []) as ApptRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); if (search.teacher) setOpen(true); /* eslint-disable-next-line */ }, [user, search.teacher]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Marked as ${status}`); void load(); }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Appointments</h1>
          <p className="text-sm text-muted-foreground">Your scheduled sessions.</p>
        </div>
        {profile?.account_type !== "teacher" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" /> Book session</Button>
            </DialogTrigger>
            <BookDialog defaultTeacherId={search.teacher} onCreated={() => { setOpen(false); void load(); }} />
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />)}</div>
      ) : appts.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No appointments yet. {profile?.account_type !== "teacher" && "Click 'Book session' to schedule with a teacher."}
        </div>
      ) : (
        <ul className="space-y-2">
          {appts.map((a) => {
            const isTeacher = a.teacher_id === user.id;
            const counterpart = isTeacher ? a.student : a.teacher;
            return (
              <li key={a.id}>
                <Link to="/appointments/$id" params={{ id: a.id }} className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <UserAvatar name={counterpart?.display_name ?? counterpart?.username} url={counterpart?.avatar_url ?? null} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{counterpart?.display_name ?? counterpart?.username}</div>
                      <div className="text-sm text-muted-foreground">{a.subject}</div>
                    </div>
                    <div className="hidden sm:block text-right text-sm">
                      <div className="flex items-center gap-1 font-mono"><Calendar className="h-3 w-3" />{format(new Date(a.starts_at), "MMM d, yyyy")}</div>
                      <div className="flex items-center gap-1 font-mono text-muted-foreground"><Clock className="h-3 w-3" />{format(new Date(a.starts_at), "h:mm a")} – {format(new Date(a.ends_at), "h:mm a")}</div>
                    </div>
                    <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                  </div>
                  {isTeacher && a.status === "pending" && (
                    <div className="mt-3 flex gap-2" onClick={(e) => e.preventDefault()}>
                      <Button size="sm" onClick={(e) => { e.preventDefault(); void updateStatus(a.id, "confirmed"); }}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm</Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); void updateStatus(a.id, "cancelled"); }}><XCircle className="h-3.5 w-3.5 mr-1" /> Decline</Button>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BookDialog({ defaultTeacherId, onCreated }: { defaultTeacherId?: string; onCreated: () => void }) {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<{ user_id: string; subjects: string[]; hourly_rate_cents: number; currency: string; profile: { username: string; display_name: string | null } | null }[]>([]);
  const [teacherId, setTeacherId] = useState(defaultTeacherId ?? "");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).from("teacher_profiles")
        .select("user_id,subjects,hourly_rate_cents,currency,profile:profiles!teacher_profiles_user_id_fkey(username,display_name)")
        .eq("accepts_bookings", true);
      setTeachers(data ?? []);
    })();
  }, []);

  const selected = teachers.find(t => t.user_id === teacherId);

  const submit = async () => {
    if (!user || !teacherId || !subject || !date) { toast.error("Fill all required fields"); return; }
    setSubmitting(true);
    const starts = new Date(`${date}T${startTime}:00`);
    const ends = new Date(starts.getTime() + Number(duration) * 60000);
    const price = selected ? Math.round(selected.hourly_rate_cents * (Number(duration) / 60)) : 0;
    const { error } = await (supabase as any).from("appointments").insert({
      teacher_id: teacherId, student_id: user.id, subject, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      price_cents: price, currency: selected?.currency ?? "USD", notes,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Booking requested"); onCreated(); }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Book a session</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Teacher</Label>
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger><SelectValue placeholder="Pick a teacher" /></SelectTrigger>
            <SelectContent>
              {teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.profile?.display_name ?? t.profile?.username} — {t.currency} {(t.hourly_rate_cents/100).toFixed(0)}/hr</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Subject</Label>
          {selected && selected.subjects.length > 0 ? (
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
              <SelectContent>{selected.subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Start</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div><Label>Duration (min)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["30","45","60","90","120"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Notes (optional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {selected && (
          <div className="text-sm rounded-md bg-muted p-3">
            Estimated price: <span className="font-semibold">{selected.currency} {((selected.hourly_rate_cents * Number(duration) / 60) / 100).toFixed(2)}</span>
          </div>
        )}
      </div>
      <DialogFooter><Button onClick={submit} disabled={submitting}><Hourglass className="h-4 w-4 mr-1.5" />{submitting ? "Booking…" : "Request booking"}</Button></DialogFooter>
    </DialogContent>
  );
}
