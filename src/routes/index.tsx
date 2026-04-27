import { createFileRoute, Link } from "@tanstack/react-router";
import { GitFork, GitBranch, Heart, MessageCircle, Sparkles, Trophy, Users, Zap, BookOpen, Paperclip } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillChain — Fork knowledge. Build skills together." },
      { name: "description", content: "A social platform where lessons are written, forked, and remixed by a community of learners and teachers. Sign in to start your chain." },
      { property: "og:title", content: "SkillChain — Fork knowledge. Build skills together." },
      { property: "og:description", content: "Write a lesson. Fork another. Watch ideas branch and grow." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, loading } = useAuth();
  const isSignedIn = !loading && !!user;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-wider mb-5 px-3 py-1 rounded-full bg-primary-muted border border-primary/20">
            <GitFork className="h-3 w-3" /> Open social learning
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight">
            Fork knowledge.
            <br />
            <span className="bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">Build skills together.</span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl mx-auto text-lg">
            SkillChain is the social platform where lessons live, evolve, and remix.
            Publish a tutorial, fork someone else's, and watch ideas branch into entire chains of learning.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {isSignedIn ? (
              <>
                <Button asChild size="lg" className="gap-2">
                  <Link to="/feed"><Sparkles className="h-4 w-4" /> Go to your feed</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/lessons/new">Write a lesson</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="gap-2">
                  <Link to="/auth">Get started — it's free</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">Sign in</Link>
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-6 font-mono">
            Sign in to explore lessons, follow authors, and join the conversation.
          </p>
        </div>
      </section>

      {/* What it does */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-center">
          A whole new way to learn together
        </h2>
        <p className="text-muted-foreground text-center mt-3 max-w-2xl mx-auto">
          Built for people who learn by sharing, remixing, and building on each other's work.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          <Feature
            icon={GitBranch}
            title="Fork any lesson"
            text="See a lesson you can improve? Fork it, edit it, republish. Original author gets credit and points."
          />
          <Feature
            icon={Heart}
            title="Like, comment, follow"
            text="React to lessons, leave threaded comments, and follow authors whose work clicks for you."
          />
          <Feature
            icon={Paperclip}
            title="Attach anything"
            text="Add PDFs, slides, images, audio, and video to your lessons. Make ideas tangible."
          />
          <Feature
            icon={MessageCircle}
            title="Public chat & DMs"
            text="Hop into the live community chat or start a private 1-on-1 conversation with file sharing."
          />
          <Feature
            icon={Trophy}
            title="Earn points & climb"
            text="Get rewarded every time someone learns from or forks your work. Compete on the leaderboard."
          />
          <Feature
            icon={Zap}
            title="Diff every fork"
            text="See exactly what changed between a lesson and its fork — like git, but for ideas."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-center">How SkillChain works</h2>
          <div className="grid sm:grid-cols-3 gap-8 mt-12">
            <Step n={1} title="Write or fork">
              Publish your own lesson in Markdown, or fork an existing one and make it your own.
            </Step>
            <Step n={2} title="Share & engage">
              Tag your work, attach files, follow others, and join discussions in the comments.
            </Step>
            <Step n={3} title="Watch it grow">
              Every fork branches your lesson into something new. Your knowledge spreads.
            </Step>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-20 text-center">
        <BookOpen className="h-10 w-10 mx-auto text-primary mb-4" />
        <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
          Start your chain today
        </h2>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Join a community of curious people who believe knowledge gets better when it's shared, forked, and rebuilt.
        </p>
        <div className="mt-8">
          {isSignedIn ? (
            <Button asChild size="lg" className="gap-2">
              <Link to="/feed"><Sparkles className="h-4 w-4" /> Open your feed</Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth"><Users className="h-4 w-4" /> Create your account</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-muted-foreground font-mono">
          <div className="flex items-center justify-center gap-2 mb-2">
            <GitFork className="h-3.5 w-3.5 text-primary" />
            <span className="font-display font-semibold text-foreground">SkillChain</span>
          </div>
          Fork knowledge. Build skills together.
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-colors">
      <div className="h-10 w-10 rounded-md bg-primary-muted text-primary grid place-items-center mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5">{text}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center mx-auto font-display font-bold text-lg">
        {n}
      </div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2">{children}</p>
    </div>
  );
}
