import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { UserAvatar } from "@/components/user-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/teacher/earnings")({
  head: () => ({ meta: [{ title: "Earnings — Leatha" }] }),
  component: () => (<RequireAuth><EarningsPage /></RequireAuth>),
});

function EarningsPage() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState({ earned: 0, pending: 0, completed: 0 });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (supabase as any)
        .from("appointments")
        .select("id,subject,starts_at,ends_at,status,price_cents,currency,student:profiles!appointments_student_id_fkey(username,display_name,avatar_url)")
        .eq("teacher_id", user.id)
        .order("starts_at", { ascending: false })
        .limit(100);
      const list = data ?? [];
      setRows(list);
      let earned = 0, pending = 0, completed = 0;
      for (const r of list) {
        const cents = r.price_cents ?? 0;
        if (r.status === "completed") { earned += cents; completed += 1; }
        else if (r.status === "confirmed" || r.status === "pending") pending += cents;
      }
      setTotals({ earned, pending, completed });
    })();
  }, [user]);

  if (profile && profile.account_type !== "teacher") {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-muted-foreground">This page is only available to teacher accounts.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Earnings</h1>
        <p className="text-sm text-muted-foreground">Track your tutoring income across sessions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile icon={DollarSign} tint="text-emerald-600 bg-emerald-500/10" label="Total Earned" value={`$${(totals.earned / 100).toFixed(2)}`} />
        <Tile icon={Clock} tint="text-amber-600 bg-amber-500/10" label="Pending Payouts" value={`$${(totals.pending / 100).toFixed(2)}`} />
        <Tile icon={CheckCircle2} tint="text-blue-600 bg-blue-500/10" label="Completed Sessions" value={String(totals.completed)} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border font-display font-semibold">Recent transactions</div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No sessions yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const mins = Math.max(0, Math.round((new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 60000));
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">{format(new Date(r.starts_at), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={r.student?.display_name ?? r.student?.username} url={r.student?.avatar_url ?? null} size="sm" />
                        <span className="text-sm">{r.student?.display_name ?? r.student?.username ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.subject}</TableCell>
                    <TableCell className="text-xs font-mono">{mins} min</TableCell>
                    <TableCell><span className="text-xs capitalize rounded-full px-2 py-0.5 bg-secondary">{r.status}</span></TableCell>
                    <TableCell className="text-right font-mono">${((r.price_cents ?? 0) / 100).toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function Tile({ icon: Icon, tint, label, value }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={`h-11 w-11 rounded-xl grid place-items-center ${tint}`}><Icon className="h-5 w-5" /></div>
      <div><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display font-bold mt-1">{value}</div></div>
    </div>
  );
}
