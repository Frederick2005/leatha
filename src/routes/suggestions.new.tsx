import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/suggestions/new")({
  component: () => (<RequireAuth><NewSuggestion /></RequireAuth>),
});

const SUBJECTS = ["Math", "Science", "English", "History", "Programming", "Art", "Music", "Other"];

function NewSuggestion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (title.trim().length < 5) { toast.error("Title too short"); return; }
    if (description.trim().length < 10) { toast.error("Add a bit more detail"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("lesson_suggestions").insert({
      title: title.trim(), description: description.trim(), subject, suggested_by: user.id,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    void trackEvent("suggestion_submit", { subject });
    toast.success("Suggestion posted");
    navigate({ to: "/suggestions/$id", params: { id: data!.id } });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-display font-bold">Suggest a lesson</h1>
      <p className="text-sm text-muted-foreground mt-1">Describe what you'd like to learn. Teachers will see this.</p>
      <form onSubmit={submit} className="space-y-4 mt-5">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Intro to vectors for physics" maxLength={140} />
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="What should the lesson cover? Why do you need it?" maxLength={2000} />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Posting…" : "Post suggestion"}</Button>
      </form>
    </div>
  );
}
