import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/teacher/availability")({
  head: () => ({ meta: [{ title: "Availability — Leatha" }] }),
  component: () => (<RequireAuth><AvailabilityPage /></RequireAuth>),
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Slot = { id?: string; day_of_week: number; start_time: string; end_time: string };

function AvailabilityPage() {
  const { user, profile } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Slot>({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (supabase as any)
        .from("teacher_availability")
        .select("*")
        .eq("teacher_id", user.id)
        .order("day_of_week").order("start_time");
      setSlots((data ?? []) as Slot[]);
      setLoading(false);
    })();
  }, [user]);

  const addSlot = async () => {
    if (!user) return;
    if (draft.start_time >= draft.end_time) { toast.error("Start time must be before end time"); return; }
    setBusy(true);
    const { data, error } = await (supabase as any)
      .from("teacher_availability")
      .insert({ teacher_id: user.id, ...draft })
      .select().single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSlots((s) => [...s, data as Slot].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)));
    toast.success("Slot added");
  };

  const removeSlot = async (id?: string) => {
    if (!id) return;
    const { error } = await (supabase as any).from("teacher_availability").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSlots((s) => s.filter((x) => x.id !== id));
  };

  if (profile && profile.account_type !== "teacher") {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-muted-foreground">This page is only available to teacher accounts.</div>;
  }

  const byDay = DAYS.map((_, i) => slots.filter((s) => s.day_of_week === i));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Weekly Availability</h1>
        <p className="text-sm text-muted-foreground">Add recurring slots when students can book you.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,auto,auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label>Day</Label>
            <Select value={String(draft.day_of_week)} onValueChange={(v) => setDraft((d) => ({ ...d, day_of_week: Number(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input type="time" value={draft.start_time} onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <Input type="time" value={draft.end_time} onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))} />
          </div>
          <Button onClick={addSlot} disabled={busy}><Plus className="h-4 w-4 mr-1" />Add slot</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {DAYS.map((d, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="font-display font-semibold mb-2">{d}</div>
            {loading ? <div className="text-xs text-muted-foreground">Loading…</div>
              : byDay[i].length === 0 ? <div className="text-xs text-muted-foreground">No availability</div>
              : (
                <ul className="space-y-2">
                  {byDay[i].map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono">
                      <span>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                      <button onClick={() => removeSlot(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove slot">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
