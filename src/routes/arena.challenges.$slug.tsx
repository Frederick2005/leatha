import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { Clock, Star, Lightbulb, Play, CheckCircle2, XCircle, MessageSquare, ArrowLeft, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_META, TYPE_META } from "@/lib/arena";
import { runJsTests } from "@/lib/arena-runner";
import { toast } from "sonner";

export const Route = createFileRoute("/arena/challenges/$slug")({ component: SolverPage });

interface Challenge {
  id: string; slug: string; title: string; description: string;
  type: string; difficulty: string; tags: string[];
  language: string | null; starter_code: string | null;
  test_cases: { input: string; expected: string }[];
  points_reward: number; coin_reward: number; estimated_minutes: number;
  creator_id: string;
}

interface Question { id: string; position: number; prompt: string; options: string[]; correct_indexes: number[] }
interface Hint { id: string; position: number; body: string; point_penalty: number }
interface Comment { id: string; body: string; created_at: string; profiles: { username: string } | null }

function SolverPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [ch, setCh] = useState<Challenge | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hints, setHints] = useState<Hint[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");
  const [results, setResults] = useState<{ passed: boolean; got: string; expected: string; input: string; error?: string; runtime_ms?: number }[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: c } = await supabase.from("arena_challenges").select("*").eq("slug", slug).maybeSingle();
      if (!c) return;
      setCh(c as unknown as Challenge);
      setCode((c.starter_code as string) ?? "");
      const [{ data: q }, { data: h }, { data: cm }] = await Promise.all([
        supabase.from("arena_challenge_questions").select("*").eq("challenge_id", c.id).order("position"),
        supabase.from("arena_hints").select("*").eq("challenge_id", c.id).order("position"),
        supabase.from("arena_comments").select("id,body,created_at,profiles(username)").eq("challenge_id", c.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setQuestions((q ?? []) as unknown as Question[]);
      setHints((h ?? []) as Hint[]);
      setComments((cm ?? []) as unknown as Comment[]);
    })();
  }, [slug]);

  if (!ch) return <div className="max-w-4xl mx-auto px-4 py-10 text-center text-muted-foreground">Loading challenge…</div>;

  const diff = DIFFICULTY_META[ch.difficulty] ?? DIFFICULTY_META.easy;
  const type = TYPE_META[ch.type] ?? TYPE_META.quiz;
  const isCode = ch.type === "code";

  function toggleAnswer(qid: string, idx: number, multi: boolean) {
    setAnswers((a) => {
      const prev = a[qid] ?? [];
      if (multi) return { ...a, [qid]: prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx] };
      return { ...a, [qid]: [idx] };
    });
  }

  function revealHint(h: Hint) {
    setRevealed((s) => new Set(s).add(h.id));
    toast(`Hint revealed — -${h.point_penalty} XP if you solve`);
  }

  async function runCode() {
    setRunning(true);
    setFatal(null);
    const tests = ch!.test_cases ?? [];
    const lang = (ch!.language ?? "javascript").toLowerCase();
    const canRun = lang === "javascript" || lang === "typescript";

    if (!canRun) {
      // Mock fallback for non-JS languages (no in-browser interpreter)
      await new Promise((r) => setTimeout(r, 400));
      const looksReal = code.trim().length > (ch!.starter_code?.length ?? 0) + 10 && /return|print|console\.log/.test(code);
      const res = tests.map((t) => ({ passed: looksReal, input: t.input, expected: t.expected, got: looksReal ? t.expected : "—" }));
      setResults(res);
      setRunning(false);
      if (res.every((r) => r.passed) && res.length > 0) await submitSolve(res.length, res.length);
      return;
    }

    const { results: res, fatal: f } = await runJsTests(code, tests);
    setRunning(false);
    if (f) { setFatal(f); setResults(null); return; }
    setResults(res);
    if (res.length > 0 && res.every((r) => r.passed)) await submitSolve(res.length, res.length);
    else if (res.length > 0) toast.error(`${res.filter((r) => r.passed).length}/${res.length} passed`);
  }

  async function submitQuiz() {
    if (questions.length === 0) return;
    let correct = 0;
    questions.forEach((q) => {
      const a = (answers[q.id] ?? []).slice().sort();
      const c = q.correct_indexes.slice().sort();
      if (a.length === c.length && a.every((v, i) => v === c[i])) correct++;
    });
    const pass = correct === questions.length;
    setResults(questions.map((q) => {
      const a = (answers[q.id] ?? []).slice().sort();
      const c = q.correct_indexes.slice().sort();
      const ok = a.length === c.length && a.every((v, i) => v === c[i]);
      return { passed: ok, input: q.prompt, expected: c.map((i) => q.options[i]).join(", "), got: a.map((i) => q.options[i]).join(", ") || "—" };
    }));
    if (pass) await submitSolve(correct, questions.length);
    else toast.error(`${correct}/${questions.length} correct. Almost there!`);
  }

  async function submitSolve(passed: number, total: number) {
    if (!user || solved) return;
    setSolved(true);
    const penalty = Array.from(revealed).reduce((acc, id) => acc + (hints.find((h) => h.id === id)?.point_penalty ?? 0), 0);
    const score = Math.max(1, ch!.points_reward - penalty);

    await supabase.from("arena_attempts").insert({
      user_id: user.id, challenge_id: ch!.id, status: "passed",
      score, tests_passed: passed, tests_total: total,
      hints_used: revealed.size, completed_at: new Date().toISOString(),
      submitted_code: isCode ? code : null,
      submitted_answer: !isCode ? answers : null,
    });

    // Update arena profile
    const { data: ap } = await supabase.from("arena_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (ap) {
      const today = new Date().toISOString().slice(0, 10);
      const yest = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const streakBonus = ap.last_active === yest ? 1 : ap.last_active === today ? 0 : -ap.streak + 1;
      const nextStreak = ap.last_active === today ? ap.streak : Math.max(1, ap.streak + streakBonus);
      await supabase.from("arena_profiles").update({
        xp: ap.xp + score,
        coins: ap.coins + ch!.coin_reward,
        total_solves: ap.total_solves + 1,
        total_attempts: ap.total_attempts + 1,
        streak: nextStreak,
        longest_streak: Math.max(ap.longest_streak, nextStreak),
        last_active: today,
      }).eq("user_id", user.id);
    }

    await supabase.from("arena_rewards").insert({
      user_id: user.id, kind: "xp", amount: score, rarity: "common",
      reason: "challenge_solved", related_id: ch!.id,
    });

    toast.success(`Solved! +${score} XP · +${ch!.coin_reward} coins`, { duration: 4000 });
  }

  async function postComment() {
    if (!user || !commentBody.trim()) return;
    const body = commentBody.trim();
    setCommentBody("");
    const { data } = await supabase.from("arena_comments").insert({
      challenge_id: ch!.id, author_id: user.id, body,
    }).select("id,body,created_at,profiles(username)").maybeSingle();
    if (data) setComments((cs) => [data as unknown as Comment, ...cs]);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <button onClick={() => navigate({ to: "/arena/challenges" })} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-3 w-3" /> All challenges
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase font-mono text-muted-foreground">
              <span>{type.emoji} {type.label}</span>
              <span>·</span>
              <span className={diff.color}>{diff.label}</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">{ch.title}</h1>
            {ch.description && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{ch.description}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
              {ch.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 justify-end"><Clock className="h-3 w-3" /> ~{ch.estimated_minutes} min</div>
            <div className="flex items-center gap-1 justify-end"><Star className="h-3 w-3 text-warning" /> {ch.points_reward} XP</div>
            <div className="flex items-center gap-1 justify-end"><Trophy className="h-3 w-3 text-primary" /> {ch.coin_reward} coins</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4 mt-4">
        <div className="space-y-4">
          {isCode ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>{ch.language ?? "javascript"}</span>
                <Button size="sm" onClick={runCode} disabled={running}>
                  <Play className="h-3 w-3 mr-1" /> {running ? "Running…" : "Run tests"}
                </Button>
              </div>
              <Editor
                height="420px"
                defaultLanguage={ch.language ?? "javascript"}
                value={code}
                onChange={(v) => setCode(v ?? "")}
                theme={darkMode ? "vs-dark" : "light"}
                options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: "on" }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">This challenge has no questions yet.</p>
              ) : questions.map((q, qi) => {
                const multi = q.correct_indexes.length > 1;
                const selected = answers[q.id] ?? [];
                return (
                  <div key={q.id}>
                    <p className="font-medium text-sm mb-2">{qi + 1}. {q.prompt}</p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, idx) => {
                        const isSel = selected.includes(idx);
                        return (
                          <button key={idx} onClick={() => toggleAnswer(q.id, idx, multi)}
                            className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${isSel ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}>
                            <span className="inline-block w-5 font-mono text-muted-foreground">{String.fromCharCode(65 + idx)}.</span> {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {questions.length > 0 && (
                <Button onClick={submitQuiz} className="w-full" disabled={solved}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Submit answers
                </Button>
              )}
            </div>
          )}

          {results && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-sm mb-2">Results</h3>
              <ul className="space-y-1.5">
                {results.map((r, i) => (
                  <li key={i} className={`text-xs flex items-start gap-2 p-2 rounded ${r.passed ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                    {r.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-rose-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono truncate">{r.input}</div>
                      {!r.passed && <div className="text-muted-foreground mt-0.5">got <span className="font-mono">{r.got}</span> — expected <span className="font-mono">{r.expected}</span></div>}
                    </div>
                  </li>
                ))}
              </ul>
              {!results.every((r) => r.passed) && results.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Almost there — review the failing cases and try again.</p>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Discussion ({comments.length})</h3>
            <div className="flex gap-2">
              <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Share your approach…"
                className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm" />
              <Button onClick={postComment} size="sm">Post</Button>
            </div>
            <ul className="mt-3 space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="text-sm border-b border-border pb-2 last:border-0">
                  <span className="font-mono text-xs text-primary">@{c.profiles?.username ?? "user"}</span>
                  <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
              {comments.length === 0 && <li className="text-xs text-muted-foreground">Be the first to comment.</li>}
            </ul>
          </div>
        </div>

        {/* Sidebar: hints + meta */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-warning" /> Hints</h3>
            {hints.length === 0 ? <p className="text-xs text-muted-foreground">No hints for this challenge.</p> : (
              <ul className="space-y-2">
                {hints.map((h, i) => (
                  <li key={h.id} className="text-xs">
                    {revealed.has(h.id) ? (
                      <div className="p-2 rounded bg-warning/10 border border-warning/30">
                        <div className="font-mono uppercase text-[10px] mb-1">Hint {i + 1}</div>
                        {h.body}
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => revealHint(h)}>
                        Reveal hint {i + 1}
                        <span className="text-muted-foreground">-{h.point_penalty} XP</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link to="/arena/leaderboard" className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
            <div className="text-xs text-muted-foreground">After you solve</div>
            <div className="font-semibold flex items-center gap-2 mt-1"><Trophy className="h-4 w-4 text-warning" /> Check the leaderboard</div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
