import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Leatha" },
      { name: "description", content: "How Leatha uses cookies and similar technologies." },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 prose prose-sm dark:prose-invert">
      <h1 className="font-display text-3xl font-bold tracking-tight">Cookie Policy</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <h2>What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. Leatha uses
        cookies and similar storage (such as <code>localStorage</code>) to keep you signed in,
        remember your theme preference, and improve performance.
      </p>

      <h2>Types of cookies we use</h2>
      <ul>
        <li>
          <strong>Essential cookies</strong> — keep you signed in and protect your account (cannot
          be disabled).
        </li>
        <li>
          <strong>Preference storage</strong> — remembers your theme, dark mode, and last activity.
        </li>
        <li>
          <strong>Performance</strong> — anonymized data to keep the site fast and stable.
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        Leatha uses Supabase Cloud for authentication, database, and storage. These services may set
        cookies required for security and session management.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can clear cookies and storage from your browser settings. Doing so will sign you out of
        Leatha and reset your preferences.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Send us a note via the{" "}
        <Link to="/feedback" className="text-primary hover:underline">
          feedback page
        </Link>
        .
      </p>
    </div>
  );
}
