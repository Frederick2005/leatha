import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — SkillChain" },
      { name: "description", content: "Send feedback to the SkillChain team." },
    ],
  }),
  component: FeedbackPage,
});

const CATEGORIES = [
  { value: "bug", label: "Bug report" },
  { value: "suggestion", label: "Suggestion" },
  { value: "complaint", label: "Complaint" },
  { value: "praise", label: "Praise" },
  { value: "other", label: "Other" },
];

function FeedbackPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState("suggestion");
  const [rating, setRating] = useState<number | null>(null);
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
      category,
      rating,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Unable to send feedback.");
      return;
    }
    setSubject(""); setMessage(""); setContact(""); setRating(null);
    setSent(true);
    toast.success("Thanks for your feedback!");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-semibold">Send feedback</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Share ideas, report bugs, or rate your experience. We read every message.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
            <p className="text-lg font-semibold">Feedback sent</p>
            <p className="text-sm text-muted-foreground mt-2">A member of the SkillChain team will review it soon.</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button asChild><Link to="/">Back to home</Link></Button>
              <Button variant="outline" onClick={() => setSent(false)}>Send another</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-[1fr_200px] gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="Short summary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={4000} placeholder="Tell us more…" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rating (optional)</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)} aria-label={`Rate ${n}`}>
                      <Star className={cn("h-7 w-7 transition", rating && n <= rating ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary")} />
                    </button>
                  ))}
                </div>
              </div>
              {!user && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact email (optional)</label>
                  <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Your feedback helps us make SkillChain better.</p>
              <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
