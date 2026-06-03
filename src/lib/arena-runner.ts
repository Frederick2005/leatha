/**
 * Sandboxed JS/TS code runner for Arena challenges.
 * Spawns a Web Worker per run, evaluates user code, then calls solve(input)
 * for each test case. Times out after 3s. Worker is terminated on completion.
 *
 * Conventions for challenge authors:
 *   - User code must define a function called `solve` (any signature).
 *   - `input` is passed as a string; coerce inside solve as needed.
 *   - The string form of the returned value is compared to `expected` (trimmed).
 */

export interface TestCase { input: string; expected: string }
export interface TestResult { passed: boolean; input: string; expected: string; got: string; error?: string; runtime_ms: number }

const WORKER_SOURCE = `
self.onmessage = async (e) => {
  const { code, tests } = e.data;
  const results = [];
  let solve;
  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function(code + "\\n;return typeof solve === 'function' ? solve : undefined;");
    solve = factory();
    if (typeof solve !== 'function') throw new Error("Define a function called 'solve(input)'.");
  } catch (err) {
    self.postMessage({ fatal: String(err && err.message || err) });
    return;
  }
  for (const t of tests) {
    const start = performance.now();
    try {
      let out = solve(t.input);
      if (out && typeof out.then === 'function') out = await out;
      const got = (out === undefined || out === null) ? String(out) :
        (typeof out === 'object' ? JSON.stringify(out) : String(out));
      const passed = got.trim() === String(t.expected).trim();
      results.push({ passed, input: t.input, expected: t.expected, got, runtime_ms: Math.round(performance.now() - start) });
    } catch (err) {
      results.push({ passed: false, input: t.input, expected: t.expected, got: '', error: String(err && err.message || err), runtime_ms: Math.round(performance.now() - start) });
    }
  }
  self.postMessage({ results });
};
`;

export async function runJsTests(code: string, tests: TestCase[], timeoutMs = 3000): Promise<{ results: TestResult[]; fatal?: string }> {
  if (typeof Worker === "undefined") {
    return { results: [], fatal: "Code runner unavailable in this environment." };
  }
  const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ results: [], fatal: `Execution timed out after ${timeoutMs}ms.` });
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent<{ results?: TestResult[]; fatal?: string }>) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      if (e.data.fatal) resolve({ results: [], fatal: e.data.fatal });
      else resolve({ results: e.data.results ?? [] });
    };

    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ results: [], fatal: e.message || "Worker error" });
    };

    worker.postMessage({ code, tests });
  });
}
