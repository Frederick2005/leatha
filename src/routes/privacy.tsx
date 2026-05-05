import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Leatha" },
      { name: "description", content: "Privacy policy for Leatha users." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-display font-semibold">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We respect your privacy and collect only the data needed to run the learning platform.
        </p>

        <section className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">1. Information we collect</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We collect account data such as email, username, display name, and any profile fields you choose to provide.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">2. How we use it</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Data is used to authenticate users, show profiles, store lessons and messages, and to improve the service.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">3. Your control</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You can update your profile, and if you want your account deleted, contact the site administrators.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">4. Feedback</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Feedback submissions may be stored to help improve Leatha and may be reviewed by administrators.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
