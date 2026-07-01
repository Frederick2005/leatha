import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { CheckCircle2, Smartphone, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export interface TeacherWithProfile {
  user_id: string;
  subjects: string[];
  hourly_rate: number; // plain UGX, e.g. 20000
  years_experience: string;
  rating_avg: number;
  rating_count: number;
  profile?: { display_name: string | null; username: string; avatar_url: string | null; school: string | null };
}

interface AvailabilityRow {
  weekday: number;
  start_time: string;
  end_time: string;
}

const PAYMENT_METHODS = [
  { id: "mtn", label: "MTN Mobile Money", color: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  { id: "airtel", label: "Airtel Money", color: "bg-red-500/15 text-red-500 border-red-500/30" },
  { id: "pesapal", label: "Pesapal", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
] as const;

type Step = "subject" | "slot" | "payment" | "success";

function generateSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  let [h] = startTime.split(":").map(Number);
  const [endH] = endTime.split(":").map(Number);
  while (h < endH) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    h += 1;
  }
  return slots;
}

export function BookingModal({
  teacher,
  open,
  onClose,
  onBooked,
}: {
  teacher: TeacherWithProfile;
  open: boolean;
  onClose: () => void;
  onBooked?: () => void;
}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(teacher.subjects.length > 1 ? "subject" : "slot");
  const [subject, setSubject] = useState(teacher.subjects[0] ?? "General");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"] | null>(null);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  // Reset state when reopened for a different teacher
  useEffect(() => {
    if (open) {
      setStep(teacher.subjects.length > 1 ? "subject" : "slot");
      setSubject(teacher.subjects[0] ?? "General");
      setSelectedDate(new Date());
      setSelectedSlot(null);
      setPaymentMethod(null);
      setPhone("");
      setNotes("");
    }
  }, [open, teacher]);

  // Fetch availability + existing bookings whenever the date changes
  useEffect(() => {
    if (!open || step !== "slot") return;
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);

    void (async () => {
      const weekday = selectedDate.getDay();
      const [{ data: avail }, { data: booked }] = await Promise.all([
        supabase
          .from("teacher_availability")
          .select("weekday, start_time, end_time")
          .eq("teacher_id", teacher.user_id)
          .eq("weekday", weekday),
        supabase
          .from("appointments")
          .select("starts_at")
          .eq("teacher_id", teacher.user_id)
          .in("status", ["pending", "confirmed"])
          .gte("starts_at", startOfDay(selectedDate).toISOString())
          .lte("starts_at", endOfDay(selectedDate).toISOString()),
      ]);

      if (cancelled) return;

      const takenTimes = new Set(
        (booked ?? []).map((b) => format(new Date(b.starts_at), "HH:mm")),
      );

      const slots = ((avail ?? []) as AvailabilityRow[]).flatMap((a) =>
        generateSlots(a.start_time, a.end_time),
      );
      const isPastToday = isSameDay(selectedDate, new Date());
      const nowHour = new Date().getHours();

      setAvailableSlots(
        [...new Set(slots)]
          .filter((s) => !takenTimes.has(s))
          .filter((s) => !isPastToday || Number(s.split(":")[0]) > nowHour)
          .sort(),
      );
      setSlotsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, step, selectedDate, teacher.user_id]);

  const confirmBooking = async () => {
    if (!user || !selectedSlot || !paymentMethod || !phone.trim()) return;
    setSubmitting(true);

    const [h, m] = selectedSlot.split(":").map(Number);
    const startsAt = new Date(selectedDate);
    startsAt.setHours(h, m, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(endsAt.getHours() + 1);

    const { error } = await supabase.from("appointments").insert({
      teacher_id: teacher.user_id,
      student_id: user.id,
      subject,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "pending",
      price_cents: teacher.hourly_rate * 100,
      notes: notes.trim() || null,
      payment_method: paymentMethod,
      payment_phone: phone.trim(),
      payment_status: "pending",
    });

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: teacher.user_id,
      type: "new_appointment",
      title: "New booking request",
      message: `${profile?.display_name ?? "A student"} requested a ${subject} session on ${format(startsAt, "MMM d, h:mm a")}`,
      link: "/appointments",
      actor_id: user.id,
    });

    setSubmitting(false);
    setStep("success");
    onBooked?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserAvatar
              name={teacher.profile?.display_name ?? teacher.profile?.username ?? "T"}
              url={teacher.profile?.avatar_url}
              size="sm"
            />
            <span>Book {teacher.profile?.display_name ?? teacher.profile?.username}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Step: subject */}
        {step === "subject" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What subject is this session for?</p>
            <div className="flex flex-wrap gap-2">
              {teacher.subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    subject === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep("slot")}>
              Continue
            </Button>
          </div>
        )}

        {/* Step: slot */}
        {step === "slot" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pick a date and time</p>

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {days.map((d) => (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    "shrink-0 flex flex-col items-center justify-center rounded-xl border px-3 py-2 min-w-[56px] transition-colors",
                    isSameDay(d, selectedDate)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="text-[10px] uppercase opacity-80">{format(d, "EEE")}</span>
                  <span className="text-sm font-semibold">{format(d, "d")}</span>
                </button>
              ))}
            </div>

            {slotsLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading available times...
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  No open slots on {format(selectedDate, "MMM d")}. Try another date, or message
                  the teacher directly to arrange a time.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    onClose();
                    navigate({ to: "/messages/$username", params: { username: teacher.profile?.username ?? "" } });
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message {teacher.profile?.display_name ?? teacher.profile?.username}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSlot(s)}
                    className={cn(
                      "text-sm py-2 rounded-lg border transition-colors",
                      selectedSlot === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <Button className="w-full" disabled={!selectedSlot} onClick={() => setStep("payment")}>
              Continue
            </Button>
          </div>
        )}

        {/* Step: payment */}
        {step === "payment" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="font-medium">{subject} session</p>
              <p className="text-muted-foreground">
                {format(selectedDate, "MMM d, yyyy")} at {selectedSlot} · 1 hour
              </p>
              <p className="text-lg font-bold mt-1">UGX {teacher.hourly_rate.toLocaleString()}</p>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2.5">
              <Smartphone className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Mobile money payments are confirmed manually for now. Submitting this booking
                sends your request to the teacher — arrange the actual payment with them directly
                using the number below.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Pay with</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={cn(
                      "text-xs py-2.5 px-1.5 rounded-lg border text-center transition-colors",
                      paymentMethod === m.id ? m.color : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Your phone number</p>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                inputMode="tel"
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Notes (optional)</p>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the teacher should know"
              />
            </div>

            <Button
              className="w-full"
              disabled={!paymentMethod || !phone.trim() || submitting}
              onClick={confirmBooking}
            >
              {submitting ? "Sending request..." : "Confirm Booking"}
            </Button>
          </div>
        )}

        {/* Step: success */}
        {step === "success" && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-semibold">Booking request sent!</p>
            <p className="text-sm text-muted-foreground">
              {teacher.profile?.display_name ?? teacher.profile?.username} will confirm your{" "}
              {subject} session shortly. You'll be notified once it's confirmed.
            </p>
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}