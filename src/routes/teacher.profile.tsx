import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DynamicSelect } from "@/components/dynamic-select";
import { X } from "lucide-react";

export const Route = createFileRoute("/teacher/profile")({
  head: () => ({ meta: [{ title: "Edit Teacher Profile — Leatha" }] }),
  component: () => (<RequireAuth><TeacherProfileEdit /></RequireAuth>),
});

const SEED_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Programming", "History", "Geography"];

function TeacherProfileEdit() {
  const { user, profile } = useAuth();
  const [bio, setBio] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [rate, setRate] = useState("");
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [experience, setExperience] = useState("0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (supabase as any).from("teacher_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setBio(data.bio_long ?? "");
        setSubjects(data.subjects ?? []);
        setRate(((data.hourly_rate_cents ?? 0) / 100).toString());
        setTz(data.timezone ?? tz);
        setExperience(String(data.years_experience ?? 0));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addSubject = (v: string) => { if (v && !subjects.includes(v)) setSubjects((s) => [...s, v]); };
  const removeSubject = (v: string) => setSubjects((s) => s.filter((x) => x !== v));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await (supabase as any).from("teacher_profiles").upsert({
      user_id: user.id,
      bio_long: bio.trim() || null,
      subjects,
      hourly_rate_cents: Math.round(Number(rate || 0) * 100),
      timezone: tz,
      years_experience: Number(experience || 0),
    }, { onConflict: "user_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Teacher profile saved");
  };

  if (!profile) return null;
  if (profile.account_type !== "teacher") {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-muted-foreground">This page is only available to teacher accounts.</div>;
  }
  if (loading) return <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-display font-semibold">Edit Teacher Profile</h1>
      <p className="text-sm text-muted-foreground mt-1">This information is shown to students on your public profile and in Find Teachers.</p>

      <form onSubmit={save} className="mt-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-32" placeholder="Describe your teaching experience, approach, and specialities…" />
        </div>

        <div className="space-y-1.5">
          <Label>Subjects taught</Label>
          <DynamicSelect category="subject" value="" onChange={addSubject} options={SEED_SUBJECTS} placeholder="Add a subject…" />
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {subjects.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1">
                  {s}
                  <button type="button" onClick={() => removeSubject(s)} aria-label={`Remove ${s}`}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Hourly rate (USD)</Label>
            <Input type="number" min="0" step="1" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="25" />
          </div>
          <div className="space-y-1.5">
            <Label>Years of experience</Label>
            <Input type="number" min="0" step="1" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="3" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Africa/Kampala" />
          <p className="text-xs text-muted-foreground">Used to convert your availability into students' local time.</p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
        </div>
      </form>
    </div>
  );
}
