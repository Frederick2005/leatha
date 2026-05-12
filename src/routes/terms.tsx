import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Leatha" },
      { name: "description", content: "Terms and conditions for using Leatha." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-display font-semibold">Terms and Conditions</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          These terms govern your use of Leatha. By using the platform, you agree to follow these
          rules.
        </p>

        <section className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">1. Use of the service</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Leatha is a collaborative learning platform. You may post lessons, attach files,
              comment, like, and message other members.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">2. Account types</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Students, teachers, and administrators have different account types. Administrator
              roles are assigned by site staff and grant access to management tools.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">3. Community guidelines</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Be respectful, avoid spam, and do not post harmful or plagiarized content. Reports are
              reviewed by moderators and admins.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">4. Intellectual property</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You retain ownership of original lessons you publish, but you grant Leatha a license
              to display, share, and improve them in the community.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">5. Changes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These terms may be updated. Continued use of Leatha after changes means you accept the
              new terms.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
