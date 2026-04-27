## What's wrong

The preview is blank because the Vite dev server crashed earlier on a syntax error in `src/routes/lessons.$lessonId.tsx` — the `RequireAuth` import had been injected in the middle of an existing `import { ... }` block, breaking it:

```text
13 | import {
14 | import { RequireAuth } from "@/components/require-auth";
15 |   AlertDialog, AlertDialogAction, ...
```

I checked the file on disk — **it's already correct now** (the `RequireAuth` import is on its own line at line 20, after the other import block closes). All other route files using `RequireAuth` are also valid.

The actual problem: the Vite dev server is stuck on the old crashed state and isn't picking up the fix. Nothing in the source needs further changes — it just needs a kick to reload.

## Fix

Touch `src/router.tsx` (a root-of-the-graph file) to force Vite to re-evaluate the module tree, which will pick up the already-corrected `lessons.$lessonId.tsx` and bring the preview back.

If after the touch the preview is still blank, I'll re-tail `/tmp/dev-server-logs/dev-server.log`, find the new top error, and fix it directly.

## Files

- No source edits needed.
- One filesystem touch on `src/router.tsx` to trigger HMR/restart.
