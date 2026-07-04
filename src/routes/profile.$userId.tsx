import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * `/profile/:userId` — public route that resolves a user id to a username
 * and forwards to the richer `/u/:username` profile page.
 */
export const Route = createFileRoute("/profile/$userId")({
  component: PublicProfileRedirect,
});

function PublicProfileRedirect() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "missing">("loading");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
      if (data?.username) navigate({ to: "/u/$username", params: { username: data.username }, replace: true });
      else setStatus("missing");
    })();
  }, [userId, navigate]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
      {status === "loading" ? "Loading profile…" : "This profile no longer exists."}
    </div>
  );
}
