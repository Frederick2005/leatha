import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Shield, Cookie, Mail } from "lucide-react";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal — SkillChain" },
      { name: "description", content: "Legal information, terms, and policies for SkillChain." },
    ],
  }),
  component: LegalPage,
});

const sections = [
  { to: "/terms" as const, icon: FileText, title: "Terms of Service", desc: "The rules that govern your use of SkillChain." },
  { to: "/privacy" as const, icon: Shield, title: "Privacy Policy", desc: "How we collect, use, and protect your data." },
  { to: "/cookies" as const, icon: Cookie, title: "Cookie Policy", desc: "How we use cookies and local storage." },
  { to: "/feedback" as const, icon: Mail, title: "Contact / Feedback", desc: "Reach out with questions or concerns." },
];

function LegalPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">Legal & policies</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Everything you need to know about using SkillChain responsibly.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 mt-8">
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-2xl border border-border bg-card p-5 hover:bg-accent/40 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-xs text-muted-foreground">
        © 2026{new Date().getFullYear() > 2026 ? `–${new Date().getFullYear()}` : ""} SkillChain. All rights reserved.
      </div>
    </div>
  );
}
