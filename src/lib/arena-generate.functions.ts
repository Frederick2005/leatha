import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  topic: z.string().min(2).max(200),
  type: z.enum(["quiz", "code"]),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  language: z.string().min(1).max(40).optional(),
});

export interface GeneratedChallenge {
  title: string;
  description: string;
  tags: string[];
  starter_code?: string;
  test_cases?: { input: string; expected: string }[];
  questions?: { prompt: string; options: string[]; correct: number[] }[];
}

const SYSTEM = `You design short, high-quality learning challenges for the "Leatha Arena" platform.
Always respond with STRICT JSON matching the requested schema. No prose, no markdown, no code fences.`;

function quizPrompt(topic: string, difficulty: string) {
  return `Create a ${difficulty} multiple-choice quiz challenge about: ${topic}.
Return JSON with this shape:
{
  "title": string (<=60 chars),
  "description": string (1-2 sentences framing the topic),
  "tags": string[] (3-5 lowercase tags),
  "questions": [
    { "prompt": string, "options": [string, string, string, string], "correct": [number] }
  ]
}
Produce exactly 4 questions. Each question has exactly 4 options. "correct" is an array of indexes (0-3) into options.`;
}

function codePrompt(topic: string, difficulty: string, language: string) {
  return `Create a ${difficulty} coding challenge in ${language} about: ${topic}.
The user must implement a function named "solve" that takes a single string "input" and returns a value whose String() form matches "expected".
Return JSON with this shape:
{
  "title": string (<=60 chars),
  "description": string (3-5 sentences: problem statement + input/output format + example),
  "tags": string[] (3-5 lowercase tags),
  "starter_code": string (the function skeleton, ${language}),
  "test_cases": [ { "input": string, "expected": string } ]
}
Produce 3-5 test cases. Inputs and expected outputs must be strings.`;
}

export const generateArenaChallenge = createServerFn({ method: "POST" })
  .inputValidator((raw) => InputSchema.parse(raw))
  .handler(async ({ data }): Promise<GeneratedChallenge> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured.");

    const prompt = data.type === "code"
      ? codePrompt(data.topic, data.difficulty, data.language ?? "javascript")
      : quizPrompt(data.topic, data.difficulty);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: GeneratedChallenge;
    try { parsed = JSON.parse(content) as GeneratedChallenge; }
    catch { throw new Error("AI returned invalid JSON."); }
    return parsed;
  });
