import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { LeathaLogo } from "@/components/leatha-logo";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Leatha" }] }),
  component: () => (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  ),
});

const TOPICS = [
  "Math",
  "Science",
  "Programming",
  "Business",
  "Design",
  "AI",
  "Languages",
  "Art",
] as const;
const LEVELS = [
  { value: "Beginner", desc: "New to this area — start with the basics." },
  { value: "Intermediate", desc: "I know the fundamentals and want to go deeper." },
  { value: "Advanced", desc: "I'm comfortable and looking for challenges." },
] as const;

type Suggested = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};
type Lesson = {
  id: string;
  title: string;
  summary: string | null;
  like_count: number;
  tags: string[];
};

function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [level, setLevel] = useState<string>("");
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [recs, setRecs] = useState<Lesson[]>([]);
  const [busy, setBusy] = useState(false);

  // If they've already completed onboarding, send them home
  useEffect(() => {
    const p = profile as unknown as { has_completed_onboarding?: boolean } | null;
    if (p?.has_completed_onboarding) navigate({ to: "/feed", replace: true });
  }, [profile, navigate]);

  const total = 5;
  const progress = useMemo(() => Math.round(((step + 1) / total) * 100), [step]);

  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const toggleInterest = (t: string) => {
    setInterests((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));
  };

  // Load follow suggestions when entering step 3
  useEffect(() => {
    if (step !== 3 || !user) return;
    void (async () => {
      const lower = interests.map((i) => i.toLowerCase());
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, lesson_count")
        .neq("id", user.id)
        .order("lesson_count", { ascending: false })
        .limit(20);
      const list = (data ?? []) as (Suggested & { lesson_count: number })[];
      // try matching tags via lessons authored
      const ids = list.map((x) => x.id);
      let matched: Suggested[] = list;
      if (ids.length && lower.length) {
        const { data: ls } = await supabase
          .from("lessons")
          .select("author_id, tags")
          .in("author_id", ids);
        const score: Record<string, number> = {};
        (ls ?? []).forEach((l: { author_id: string; tags: string[] }) => {
          const overlap = (l.tags ?? []).filter((t) => lower.includes(t.toLowerCase())).length;
          score[l.author_id] = (score[l.author_id] ?? 0) + overlap;
        });
        matched = [...list].sort((a, b) => (score[b.id] ?? 0) - (score[a.id] ?? 0));
      }
      setSuggested(matched.slice(0, 6));
    })();
  }, [step, user, interests]);

  // Load recommendations on step 4
  useEffect(() => {
    if (step !== 4) return;
    void (async () => {
      const lower = interests.map((i) => i.toLowerCase());
      const { data } = await supabase
        .from("lessons")
        .select("id, title, summary, like_count, tags")
        .eq("is_published", true)
        .order("like_count", { ascending: false })
        .limit(50);
      const all = (data ?? []) as Lesson[];
      const scored = all.map((l) => ({
        l,
        score: (l.tags ?? []).filter((t) => lower.includes(t.toLowerCase())).length,
      }));
      scored.sort((a, b) => b.score - a.score || b.l.like_count - a.l.like_count);
      setRecs(scored.slice(0, 8).map((s) => s.l));
    })();
  }, [step, interests]);

  const toggleFollow = async (id: string) => {
    if (!user) return;
    const has = following.has(id);
    if (has) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", id);
      setFollowing((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, followee_id: id });
      setFollowing((s) => new Set(s).add(id));
    }
  };

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        has_completed_onboarding: true,
        interests,
        skill_level: level,
      } as never)
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("You're all set!");
    navigate({ to: "/feed", replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm transition-all">
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="inline-flex text-primary">
                <LeathaLogo size={72} />
              </div>
              <h1 className="text-3xl font-display font-bold">Welcome to Leatha</h1>
              <p className="text-muted-foreground">Learn, create, and grow with Leatha.</p>
              <Button size="lg" className="mt-2" onClick={next}>
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-display font-semibold">What are you into?</h2>
                <p className="text-sm text-muted-foreground">
                  Pick at least one topic to personalize your feed.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TOPICS.map((t) => {
                  const on = interests.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleInterest(t)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                        on
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted hover:bg-muted/70",
                      )}
                    >
                      {on && <Check className="inline h-4 w-4 mr-1 text-primary" />}
                      {t}
                    </button>
                  );
                })}
              </div>
              <Footer onBack={back} onNext={next} nextDisabled={interests.length === 0} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-display font-semibold">What's your level?</h2>
                <p className="text-sm text-muted-foreground">
                  We'll tune recommendations to your pace.
                </p>
              </div>
              <div className="space-y-2">
                {LEVELS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLevel(l.value)}
                    className={cn(
                      "w-full text-left rounded-xl border px-4 py-3 transition-all",
                      level === l.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted hover:bg-muted/70",
                    )}
                  >
                    <div className="font-semibold">{l.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
                  </button>
                ))}
              </div>
              <Footer onBack={back} onNext={next} nextDisabled={!level} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-display font-semibold">Follow a few people</h2>
                <p className="text-sm text-muted-foreground">
                  Suggestions based on your interests. You can skip.
                </p>
              </div>
              <div className="space-y-2">
                {suggested.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No suggestions yet — you can always discover later.
                  </p>
                )}
                {suggested.map((s) => {
                  const on = following.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          name={s.display_name ?? s.username}
                          url={s.avatar_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{s.display_name ?? s.username}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            @{s.username}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={on ? "secondary" : "default"}
                        onClick={() => toggleFollow(s.id)}
                      >
                        {on ? "Following" : "Follow"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Footer onBack={back} onNext={next} nextLabel="Continue" />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary" /> Picked for you
                </h2>
                <p className="text-sm text-muted-foreground">
                  A starting set of lessons based on what you chose.
                </p>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {recs.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No published lessons yet — be the first to create one!
                  </p>
                )}
                {recs.map((l) => (
                  <div key={l.id} className="rounded-xl border border-border bg-muted/40 p-3">
                    <div className="font-medium">{l.title}</div>
                    {l.summary && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {l.summary}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(l.tags ?? []).slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] uppercase font-mono text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button variant="ghost" onClick={back}>
                  Back
                </Button>
                <Button onClick={finish} disabled={busy}>
                  {busy ? "Finishing…" : "Enter Leatha"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Footer({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Next",
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button variant="ghost" onClick={onBack}>
        Back
      </Button>
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
1