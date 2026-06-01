import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/arena";
import { toast } from "sonner";

export const Route = createFileRoute("/arena/studio")({ component: StudioPage });

interface Q { prompt: string; options: string[]; correct: number[] }

function StudioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<"quiz" | "code">("quiz");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy"|"medium"|"hard"|"expert">("easy");
  const [tags, setTags] = useState("");
  const [points, setPoints] = useState(10);
  const [minutes, setMinutes] = useState(5);
  const [language, setLanguage] = useState("javascript");
  const [starter, setStarter] = useState("function solve(input) {\n  // TODO\n  return input;\n}");
  const [testCases, setTestCases] = useState<{ input: string; expected: string }[]>([{ input: "1", expected: "1" }]);
  const [questions, setQuestions] = useState<Q[]>([{ prompt: "", options: ["", "", "", ""], correct: [0] }]);
  const [saving, setSaving] = useState(false);

  async function save(publish: boolean) {
    if (!user || !title.trim()) return toast.error("Title required");
    setSaving(true);
    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: c, error } = await supabase.from("arena_challenges").insert({
      creator_id: user.id,
      title: title.trim(),
      slug,
      description: description.trim(),
      type,
      difficulty,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      points_reward: points,
      estimated_minutes: minutes,
      language: type === "code" ? language : null,
      starter_code: type === "code" ? starter : null,
      test_cases: type === "code" ? testCases : [],
      status: publish ? "published" : "draft",
    }).select().maybeSingle();
    if (error || !c) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    if (type === "quiz") {
      const rows = questions
        .filter((q) => q.prompt.trim() && q.options.some((o) => o.trim()))
        .map((q, i) => ({
          challenge_id: c.id,
          position: i,
          prompt: q.prompt.trim(),
          options: q.options,
          correct_indexes: q.correct,
        }));
      if (rows.length > 0) await supabase.from("arena_challenge_questions").insert(rows);
    }

    toast.success(publish ? "Published to Arena" : "Saved as draft");
    setSaving(false);
    navigate({ to: "/arena/challenges/$slug", params: { slug } });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary" /> Teacher Studio</h1>
        <p className="text-sm text-muted-foreground">Author a new challenge. Publish to share it with the arena.</p>
      </header>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex gap-2">
          {(["quiz", "code"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-md text-sm border ${type === t ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
              {t === "quiz" ? "🧠 Quiz" : "💻 Code"}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <Textarea placeholder="Description / problem statement" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as typeof difficulty)} options={["easy","medium","hard","expert"]} />
          <NumberField label="XP reward" value={points} onChange={setPoints} />
          <NumberField label="Est. minutes" value={minutes} onChange={setMinutes} />
          {type === "code" && <Select label="Language" value={language} onChange={setLanguage} options={["javascript","typescript","python","java","cpp"]} />}
        </div>

        {type === "code" ? (
          <>
            <div>
              <label className="text-xs uppercase font-mono text-muted-foreground">Starter code</label>
              <Textarea value={starter} onChange={(e) => setStarter(e.target.value)} rows={6} className="font-mono text-xs" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase font-mono text-muted-foreground">Test cases</label>
                <Button size="sm" variant="ghost" onClick={() => setTestCases([...testCases, { input: "", expected: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {testCases.map((tc, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input placeholder="input" value={tc.input} onChange={(e) => setTestCases(testCases.map((t, j) => i===j ? { ...t, input: e.target.value } : t))} />
                    <Input placeholder="expected" value={tc.expected} onChange={(e) => setTestCases(testCases.map((t, j) => i===j ? { ...t, expected: e.target.value } : t))} />
                    <Button size="icon" variant="ghost" onClick={() => setTestCases(testCases.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase font-mono text-muted-foreground">Questions</label>
              <Button size="sm" variant="ghost" onClick={() => setQuestions([...questions, { prompt: "", options: ["","","",""], correct: [0] }])}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-3">
              {questions.map((q, qi) => (
                <div key={qi} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder={`Question ${qi+1}`} value={q.prompt} onChange={(e) => setQuestions(questions.map((x, j) => qi===j ? { ...x, prompt: e.target.value } : x))} />
                    <Button size="icon" variant="ghost" onClick={() => setQuestions(questions.filter((_, j) => j !== qi))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="checkbox" checked={q.correct.includes(oi)} onChange={(e) => {
                        setQuestions(questions.map((x, j) => qi!==j ? x : { ...x, correct: e.target.checked ? [...x.correct, oi] : x.correct.filter((i) => i !== oi) }));
                      }} />
                      <Input placeholder={`Option ${String.fromCharCode(65+oi)}`} value={opt}
                        onChange={(e) => setQuestions(questions.map((x, j) => qi!==j ? x : { ...x, options: x.options.map((o, k) => k===oi ? e.target.value : o) }))} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>Save draft</Button>
          <Button onClick={() => save(true)} disabled={saving}><Save className="h-4 w-4 mr-1" /> Publish</Button>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-mono text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-mono text-muted-foreground">{label}</label>
      <Input type="number" value={value} min={1} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))} />
    </div>
  );
}
