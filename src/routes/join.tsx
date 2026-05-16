import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { LeathaLogo } from "@/components/leatha-logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/join")({
  validateSearch: (s) => z.object({ ref: z.string().optional() }).parse(s),
  component: JoinPage,
});

function JoinPage() {
  const { ref } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [valid, setValid] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);

  // Validate the invite code
  useEffect(() => {
    if (!ref) { setValid(false); return; }
    supabase
      .from("invite_links")
      .select("code")
      .eq("code", ref)
      .maybeSingle()
      .then(({ data }) => setValid(!!data));
  }, [ref]);

  // Record use when logged-in user lands with a valid code
  useEffect(() => {
    if (!user || !ref || valid !== true || recording) return;
    setRecording(true);
    supabase
      .from("invite_uses")
      .upsert({ invite_code: ref, used_by: user.id }, { onConflict: "invite_code,used_by" })
      .then(({ error }) => {
        if (error) console.error("Failed to record invite use", error);
      });
  }, [user, ref, valid, recording]);

  const handleJoin = () => {
    // Store ref in sessionStorage so auth page can pick it up after signup
    if (ref) sessionStorage.setItem("invite_ref", ref);
    navigate({ to: "/auth", search: { redirect: "/feed" } });
  };

  if (valid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Checking invite...</p>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold">Invalid invite link</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This invite link is invalid or has been removed.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex h-14 w-14 items-center justify-center mb-4 text-primary">
          <LeathaLogo size={56} />
        </div>
        <h1 className="text-3xl font-bold">You're invited to Leatha</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Fork knowledge. Build skills together. Join a community of students and teachers
          learning in the open.
        </p>
        <Button className="mt-8 w-full" size="lg" onClick={handleJoin}>
          Accept invite & sign up
        </Button>
        {user && (
          <p className="text-xs text-muted-foreground mt-3">
            Already signed in? Your invite has been recorded.
          </p>
        )}
      </div>
    </div>
  );
}