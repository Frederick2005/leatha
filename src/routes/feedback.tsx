import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — SkillChain" },
      { name: "description", content: "Send feedback to the SkillChain team." },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required.");
      return;
    }
    setBusy(true);
    const bodyText = user
      ? message.trim()
      : `${message.trim()}${contact.trim() ? `\n\nContact: ${contact.trim()}` : ""}`;
    const { error } = await supabase.from("feedback").insert({
      subject: subject.trim(),
      body: bodyText,
      user_id: user?.id ?? null,
      category: profile?.account_type ?? "general",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Unable to send feedback.");
      return;
    }
    setSubject("");
    setMessage("");
    setContact("");
    setSent(true);
    toast.success("Thanks for your feedback!");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-semibold">Send feedback</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Share ideas, report bugs, or request improvements. We read every message.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
            <p className="text-lg font-semibold">Feedback sent</p>
            <p className="text-sm text-muted-foreground mt-2">
              We appreciate your input. A member of the SkillChain team will review it soon.
            </p>
            <Button asChild className="mt-4"><Link to="/">Back to home</Link></Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Feature request, bug report, idea…" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder="Tell us what you want to see improved." />
              </div>
              {!user && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact email (optional)</label>
                  <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Your feedback helps us make SkillChain better for students, teachers, and admins.
              </p>
              <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
