import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/settings")({
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
});

function SettingsPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    await refreshProfile();
  };

  if (!user || !profile) return <div className="h-screen" />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-display font-semibold">Profile settings</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={displayName || profile.username}
            url={avatarUrl || undefined}
            size="xl"
          />
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
              Avatar URL
            </Label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Username
          </Label>
          <Input value={profile.username} disabled />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Display name
          </Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Bio
          </Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            className="min-h-24"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
