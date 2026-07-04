import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, Mail, BookOpen, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & Support — Leatha" }] }),
  component: HelpPage,
});

const FAQS = [
  { q: "How do I book a tutoring session?", a: "Head to Find Teachers, pick a tutor whose subjects match your goals, and click Book a Session on their profile. You'll pick a time from their availability and confirm." },
  { q: "How do I upload documents to share with my tutor?", a: "Open the Documents page from the sidebar and drag a file into the uploader. Supported types include PDF and Word documents up to a reasonable size." },
  { q: "How do payouts work for teachers?", a: "Completed sessions are aggregated on your Earnings page. Payouts are processed via the mobile-money method you configure in Settings." },
  { q: "How do I change my availability?", a: "Teachers can go to Teacher → Availability and add or remove weekly recurring slots. Students see these in your public profile." },
  { q: "Where can I see my past appointments?", a: "The Appointments page lists upcoming and past sessions. Click any appointment for details, reviews, and payment status." },
  { q: "I lost access to my account, what do I do?", a: "Use the Contact form below with your registered email address and we'll help you recover access." },
];

function HelpPage() {
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !email.trim()) { toast.error("Fill in all fields"); return; }
    setBusy(true);
    const { error } = await (supabase as any).from("support_tickets").insert({
      user_id: user?.id ?? null,
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket submitted — we'll be in touch soon");
    setSubject(""); setMessage("");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><LifeBuoy className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-display font-semibold">Help & Support</h1>
          <p className="text-sm text-muted-foreground">Find quick answers, or reach out to our team below.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display font-semibold mb-3">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`i${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <a href="#" className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-primary mt-0.5" />
          <div><div className="font-semibold">Documentation</div><div className="text-xs text-muted-foreground">Guides, how-tos, and platform reference.</div></div>
        </a>
        <a href="#" className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors flex items-start gap-3">
          <PlayCircle className="h-5 w-5 text-primary mt-0.5" />
          <div><div className="font-semibold">Tutorial Videos</div><div className="text-xs text-muted-foreground">Short walkthroughs to get productive fast.</div></div>
        </a>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display font-semibold mb-1">Contact us</h2>
        <p className="text-sm text-muted-foreground mb-4">Send us a message and we'll get back to you as soon as we can.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Your email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly describe the issue" maxLength={140} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-32" placeholder="What's happening? Include steps to reproduce if it's a bug." />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}><Mail className="h-4 w-4 mr-1" />{busy ? "Sending…" : "Send message"}</Button>
          </div>
          {profile && <p className="text-xs text-muted-foreground">Submitting as @{profile.username}.</p>}
        </form>
      </section>
    </div>
  );
}
