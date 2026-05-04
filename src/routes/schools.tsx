import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bank, Check, X, Clock, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/schools")({
  head: () => ({ meta: [{ title: "Schools — SkillChain" }] }),
  component: () => (<RequireAuth><SchoolsPage /></RequireAuth>),
});

interface School { id: string; name: string; code: string; }
interface Membership { id: string; school_id: string; status: string; school?: School | null; }

function SchoolsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("teacher_schools").select("*").eq("teacher_id", user.id);
    const rows = (data ?? []) as Membership[];
    if (rows.length) {
      const ids = Array.from(new Set(rows.map((r) => r.school_id)));
      const { data: schools } = await supabase.from("schools").select("id, name, code").in("id", ids);
      const map = new Map((schools ?? []).map((s) => [s.id, s as School]));
      rows.forEach((r) => { r.school = map.get(r.school_id) ?? null; });
    }
    setMemberships(rows);
  };
  useEffect(() => { void load(); }, [user]);

  const join = async () => {
    if (!user || !code.trim()) return;
    setBusy(true);
    const { data: school } = await supabase.from("schools").select("id, name, code").eq("code", code.trim()).maybeSingle();
    if (!school) { setBusy(false); toast.error("No school found with that code"); return; }
    const { error } = await supabase.from("teacher_schools").insert({ teacher_id: user.id, school_id: school.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Request sent to ${school.name}`);
    setCode("");
    void load();
  };

  const leave = async (id: string) => {
    const { error } = await supabase.from("teacher_schools").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Left school"); void load(); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold flex items-center gap-2">
          <Bank className="h-7 w-7 text-primary" /> Schools
        </h1>
        <p className="text-muted-foreground mt-1">
          Join a school to collaborate with verified teachers, or stay independent as a freelancer.
          {profile?.is_verified && <span className="ml-2 inline-flex items-center gap-1 text-primary"><BadgeCheck className="h-4 w-4" /> Verified</span>}
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-3">Join with a school code</h2>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SKILL-2026" />
          <Button onClick={join} disabled={busy || !code.trim()}>Request to join</Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-3">Your schools</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't joined any schools yet. You can keep teaching as a freelancer or request to join one above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{m.school?.name ?? "Unknown school"}</div>
                  <div className="text-xs text-muted-foreground font-mono">{m.school?.code}</div>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === "pending" && <span className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600"><Clock className="h-3 w-3" /> Pending</span>}
                  {m.status === "approved" && <span className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600"><Check className="h-3 w-3" /> Approved</span>}
                  {m.status === "rejected" && <span className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive"><X className="h-3 w-3" /> Rejected</span>}
                  <Button size="sm" variant="ghost" onClick={() => leave(m.id)}>Leave</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Need to administer a school? Ask an admin to create one for you in the <Link to="/admin" className="text-primary hover:underline">admin dashboard</Link>.
      </p>
    </div>
  );
}
