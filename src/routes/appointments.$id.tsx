import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, Star, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/appointments/$id")({
  head: () => ({ meta: [{ title: "Appointment — Leatha" }] }),
  component: () => (<RequireAuth><ApptDetail /></RequireAuth>),
});

function ApptDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appt, setAppt] = useState<any>(null);
  const [review, setReview] = useState<{ rating: number; comment: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await (supabase as any).from("appointments")
      .select("*,teacher:profiles!appointments_teacher_id_fkey(username,display_name,avatar_url),student:profiles!appointments_student_id_fkey(username,display_name,avatar_url)")
      .eq("id", id).maybeSingle();
    setAppt(data);
    if (data && user) {
      const { data: r } = await (supabase as any).from("teacher_reviews").select("rating,comment").eq("appointment_id", id).eq("student_id", user.id).maybeSingle();
      setReview(r);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id, user]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!appt) return <div className="p-8 text-muted-foreground">Not found.</div>;
  if (!user) return null;

  const isTeacher = appt.teacher_id === user.id;
  const counterpart = isTeacher ? appt.student : appt.teacher;

  const setStatus = async (status: string) => {
    const { error } = await (supabase as any).from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Marked ${status}`); void load(); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <button onClick={() => navigate({ to: "/appointments" })} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <UserAvatar name={counterpart?.display_name ?? counterpart?.username} url={counterpart?.avatar_url ?? null} size="lg" />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">{isTeacher ? "Student" : "Teacher"}</div>
            <Link to="/u/$username" params={{ username: counterpart?.username ?? "" }} className="text-xl font-display font-semibold hover:text-primary">
              {counterpart?.display_name ?? counterpart?.username}
            </Link>
            <div className="text-sm text-muted-foreground font-mono">@{counterpart?.username}</div>
          </div>
          <span className={`text-xs font-medium rounded-full px-2.5 py-1 capitalize ${
            appt.status === "confirmed" ? "bg-blue-500/10 text-blue-600" :
            appt.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
            appt.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-600"
          }`}>{appt.status}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs uppercase font-mono text-muted-foreground">Subject</div><div className="font-medium">{appt.subject}</div></div>
          <div><div className="text-xs uppercase font-mono text-muted-foreground">Price</div><div className="font-medium">{appt.currency} {(appt.price_cents/100).toFixed(2)}</div></div>
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /><span>{format(new Date(appt.starts_at), "EEEE, MMM d, yyyy")}</span></div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><span>{format(new Date(appt.starts_at), "h:mm a")} – {format(new Date(appt.ends_at), "h:mm a")}</span></div>
        </div>

        {appt.notes && (
          <div className="mt-4">
            <div className="text-xs uppercase font-mono text-muted-foreground mb-1">Notes</div>
            <p className="text-sm whitespace-pre-wrap">{appt.notes}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {isTeacher && appt.status === "pending" && (<>
            <Button onClick={() => setStatus("confirmed")}><CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm</Button>
            <Button variant="outline" onClick={() => setStatus("cancelled")}><XCircle className="h-4 w-4 mr-1.5" /> Decline</Button>
          </>)}
          {isTeacher && appt.status === "confirmed" && (
            <Button onClick={() => setStatus("completed")}><CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark complete</Button>
          )}
          {!isTeacher && appt.status !== "cancelled" && appt.status !== "completed" && (
            <Button variant="outline" onClick={() => setStatus("cancelled")}><XCircle className="h-4 w-4 mr-1.5" /> Cancel</Button>
          )}
          {!isTeacher && appt.status === "pending" && (
            <PayDialog appointment={appt} onPaid={load} />
          )}
          <Button asChild variant="outline"><Link to="/messages/$username" params={{ username: counterpart?.username ?? "" }}>Message</Link></Button>
        </div>
      </div>

      {!isTeacher && appt.status === "completed" && (
        <ReviewCard appointmentId={appt.id} teacherId={appt.teacher_id} studentId={user.id} existing={review} onSaved={load} />
      )}
    </div>
  );
}

function PayDialog({ appointment, onPaid }: { appointment: any; onPaid: () => void }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!phone) { toast.error("Phone number required"); return; }
    setBusy(true);
    const { error } = await (supabase as any).from("payment_intents").insert({
      appointment_id: appointment.id, payer_id: appointment.student_id, payee_id: appointment.teacher_id,
      provider, phone_number: phone, amount_cents: appointment.price_cents, currency: appointment.currency,
      status: "pending",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Payment request sent to your phone"); setOpen(false); onPaid(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><CreditCard className="h-4 w-4 mr-1.5" /> Pay with mobile money</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Mobile money payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                <SelectItem value="airtel">Airtel Money</SelectItem>
                <SelectItem value="paxtel">PaxTel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Phone number</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256…" /></div>
          <div className="text-sm rounded-md bg-muted p-3">Amount: <span className="font-semibold">{appointment.currency} {(appointment.price_cents/100).toFixed(2)}</span></div>
          <p className="text-xs text-muted-foreground">A payment prompt will be sent to your phone. Approve it to complete the booking.</p>
        </div>
        <DialogFooter><Button onClick={pay} disabled={busy}>{busy ? "Sending…" : "Send payment request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewCard({ appointmentId, teacherId, studentId, existing, onSaved }: { appointmentId: string; teacherId: string; studentId: string; existing: { rating: number; comment: string } | null; onSaved: () => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const payload = { appointment_id: appointmentId, teacher_id: teacherId, student_id: studentId, rating, comment };
    const { error } = existing
      ? await (supabase as any).from("teacher_reviews").update({ rating, comment }).eq("appointment_id", appointmentId).eq("student_id", studentId)
      : await (supabase as any).from("teacher_reviews").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Review saved"); onSaved(); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-display font-semibold mb-3">{existing ? "Your review" : "Leave a review"}</h3>
      <div className="flex items-center gap-1 mb-3">
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star className={`h-6 w-6 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your experience…" />
      <Button className="mt-3" onClick={save} disabled={busy}>{busy ? "Saving…" : existing ? "Update review" : "Submit review"}</Button>
    </div>
  );
}
