import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for the recovery event triggered by the email link
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check if hash is present
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) setReady(true);
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) { toast.error("Min 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-display font-bold">Set a new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ready ? "Enter a strong new password below." : "Open this page from the email link to continue."}
        </p>
        <form onSubmit={submit} className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> New password
            </Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" disabled={!ready} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
