import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { RequireAuth } from "@/components/require-auth";
import { uploadAvatar } from "@/lib/avatar-upload";

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
  const [learningGoals, setLearningGoals] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setLearningGoals(((profile as any).learning_goals as string) ?? "");
    }
  }, [profile]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatarUrl(url);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      learning_goals: learningGoals.trim() || null,
    } as any).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    await refreshProfile();
  };

  if (!user || !profile) return <div className="h-screen" />;
  const isStudent = profile.account_type === "student";

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
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {uploading ? "Uploading…" : "Change photo"}
            </Button>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
              Or paste an image URL
            </Label>
              <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
            </div>
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
        {isStudent && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Learning goals</Label>
            <Textarea value={learningGoals} onChange={(e) => setLearningGoals(e.target.value)} maxLength={500} className="min-h-20" placeholder="What are you hoping to master?" />
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
