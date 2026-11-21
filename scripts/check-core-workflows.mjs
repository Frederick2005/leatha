import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const walk = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const migrationFiles = walk("supabase/migrations").filter((file) => file.endsWith(".sql"));
const migrationSql = migrationFiles.map(read).join("\n");
const sourceFiles = [...walk("src"), ...walk("supabase/functions")].filter((file) =>
  /\.(ts|tsx|js|jsx)$/.test(file),
);
const source = sourceFiles.map(read).join("\n");

const migratedTables = new Set(
  [
    ...migrationSql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["`]?([a-z_][\w]*)/gi,
    ),
  ].map((m) => m[1].toLowerCase()),
);
const referencedNames = new Set(
  [...source.matchAll(/\.from\(\s*["']([a-z_][\w-]*)["']\s*\)/g)].map((m) => m[1].toLowerCase()),
);
const storageBuckets = new Set(
  [...migrationSql.matchAll(/values\s*\(\s*['"]([a-z0-9_-]+)['"]\s*,\s*['"][^'"]+['"]/gi)].map(
    (m) => m[1].toLowerCase(),
  ),
);
const missingTables = [...referencedNames].filter(
  (name) => !migratedTables.has(name) && !storageBuckets.has(name),
);
assert.deepEqual(
  missingTables,
  [],
  `Referenced Supabase tables/buckets lack migrations: ${missingTables.join(", ")}`,
);

const checks = [
  [
    "profile onboarding fields",
    /ADD COLUMN IF NOT EXISTS grade TEXT[\s\S]*ADD COLUMN IF NOT EXISTS experience TEXT[\s\S]*ADD COLUMN IF NOT EXISTS subjects TEXT\[\]/i.test(
      migrationSql,
    ),
  ],
  [
    "analytics event payload fields",
    /ADD COLUMN IF NOT EXISTS session_id text[\s\S]*ADD COLUMN IF NOT EXISTS device_type text[\s\S]*ADD COLUMN IF NOT EXISTS event_data jsonb/i.test(
      migrationSql,
    ),
  ],
  [
    "feedback workflow fields",
    /ADD COLUMN IF NOT EXISTS category text[\s\S]*ADD COLUMN IF NOT EXISTS status text/i.test(
      migrationSql,
    ) && /ADD COLUMN IF NOT EXISTS rating integer/i.test(migrationSql),
  ],
  [
    "private documents bucket",
    /VALUES\s*\(\s*'documents'\s*,\s*'documents'\s*,\s*false/i.test(migrationSql),
  ],
  [
    "document visibility storage policy",
    /CREATE POLICY "docs_select_visible"[\s\S]*public\.documents[\s\S]*visibility = 'students'/i.test(
      migrationSql,
    ),
  ],
  [
    "teacher membership approval protection",
    /Teachers request to join[\s\S]*status = 'pending'[\s\S]*School admins moderate memberships/i.test(
      migrationSql,
    ),
  ],
  [
    "call host update restriction",
    /CREATE POLICY "calls_host_update"[\s\S]*auth\.uid\(\) = host_id/i.test(migrationSql),
  ],
  [
    "custom option atomic RPC",
    /FUNCTION public\.record_custom_option/i.test(migrationSql) &&
      /rpc\("record_custom_option"/i.test(read("src/components/dynamic-select.tsx")),
  ],
  [
    "teacher onboarding profile creation",
    /from\("teacher_profiles"\)[\s\S]*upsert/i.test(read("src/routes/onboarding.tsx")),
  ],
  [
    "private document upload rollback",
    /from\("documents"\)\.upload/i.test(read("src/routes/documents.tsx")) &&
      /storage\.from\("documents"\)\.remove\(\[path\]\)/i.test(read("src/routes/documents.tsx")),
  ],
  [
    "LiveKit token requires authenticated caller",
    /request\.headers\.get\("authorization"\)/i.test(read("src/routes/api/get-token.ts")) &&
      /auth\.getUser\(accessToken\)/i.test(read("src/routes/api/get-token.ts")),
  ],
  [
    "LiveKit request cannot grant room admin",
    !/roomAdmin\s*:/i.test(read("src/routes/api/get-token.ts")),
  ],
  [
    "LiveKit internal helper has no caller-controlled host grant",
    !/isHost|roomAdmin/i.test(read("src/lib/livekit.server.ts")),
  ],
  [
    "LiveKit server function requires auth middleware",
    /middleware\(\[requireSupabaseAuth\]\)/i.test(read("src/lib/livekit.functions.ts")),
  ],
  [
    "LiveKit Edge Function verifies Supabase identity",
    /auth\.getUser\(accessToken\)/i.test(read("supabase/functions/get-livekit-token/index.ts")),
  ],
  [
    "Privileged role updates and final controller protected",
    /BEFORE INSERT OR UPDATE OR DELETE ON public\.user_roles/i.test(migrationSql) &&
      /final super administrator cannot be removed/i.test(migrationSql) &&
      /role IN \('moderator', 'admin', 'super_admin'\)/i.test(migrationSql),
  ],
];

checks.push(
  [
    "profile privilege fields restricted to admins",
    (() => {
      const body =
        migrationSql.match(
          /CREATE OR REPLACE FUNCTION public\.guard_profile_privileged_fields\(\)([\s\S]*?)\n\$\$;/i,
        )?.[1] ?? "";
      return (
        body.includes("NEW.account_type IS DISTINCT FROM OLD.account_type") &&
        body.includes("NEW.is_verified IS DISTINCT FROM OLD.is_verified") &&
        body.includes("public.has_role(auth.uid(), 'admin')") &&
        !body.includes("public.is_mod_or_admin")
      );
    })(),
  ],
  [
    "profile administrative UPDATE policy excludes moderators",
    (() => {
      const policy =
        migrationSql.match(/CREATE POLICY "Admins update profiles"([\s\S]*?);/i)?.[1] ?? "";
      return (
        policy.includes("FOR UPDATE TO authenticated") &&
        policy.includes("public.has_role(auth.uid(), 'admin')") &&
        policy.includes("public.is_super_admin(auth.uid())") &&
        !policy.includes("public.is_mod_or_admin")
      );
    })(),
  ],
  [
    "teacher reputation and earnings aggregates protected from moderators",
    (() => {
      const body =
        migrationSql.match(
          /CREATE OR REPLACE FUNCTION public\.guard_teacher_profile_aggregates\(\)([\s\S]*?)\n\$\$;/i,
        )?.[1] ?? "";
      return (
        body.includes("NEW.rating_avg IS DISTINCT FROM OLD.rating_avg") &&
        body.includes("NEW.rating_count IS DISTINCT FROM OLD.rating_count") &&
        body.includes("NEW.students_count IS DISTINCT FROM OLD.students_count") &&
        body.includes("NEW.total_earnings_cents IS DISTINCT FROM OLD.total_earnings_cents") &&
        body.includes("public.has_role(auth.uid(), 'admin')") &&
        !body.includes("public.is_mod_or_admin")
      );
    })(),
  ],
);

checks.push(
  [
    "mutual block RPC checks both directions and hides block records",
    /FUNCTION public\.can_interact_with_user\(_other_user_id uuid\)[\s\S]*?SECURITY DEFINER[\s\S]*?b\.blocker_id = auth\.uid\(\)[\s\S]*?b\.blocked_id = _other_user_id[\s\S]*?b\.blocker_id = _other_user_id[\s\S]*?b\.blocked_id = auth\.uid\(\)/i.test(
      migrationSql,
    ) &&
      /REVOKE ALL ON FUNCTION public\.can_interact_with_user\(uuid\) FROM PUBLIC/i.test(
        migrationSql,
      ),
  ],
  [
    "direct message inserts reject either-direction blocks",
    /CREATE POLICY "Users send DMs"[\s\S]*?public\.can_interact_with_user\(recipient_id\)/i.test(
      migrationSql,
    ),
  ],
  [
    "all LiveKit token paths reject blocked participants",
    /can_interact_with_user/i.test(read("src/routes/api/get-token.ts")) &&
      /can_interact_with_user/i.test(read("src/lib/livekit.functions.ts")) &&
      /can_interact_with_user/i.test(read("supabase/functions/get-livekit-token/index.ts")),
  ],
  [
    "message UI distinguishes own block from other user's block",
    /blockedByOther/i.test(read("src/routes/messages.$username.tsx")) &&
      /interactionBlocked/i.test(read("src/routes/messages.$username.tsx")),
  ],
);

checks.push(
  [
    "support ticket submissions restrict user ownership",
    /REVOKE INSERT ON TABLE public\.support_tickets FROM PUBLIC, anon, authenticated/i.test(
      migrationSql,
    ) &&
      /CREATE POLICY "Guests submit unlinked tickets"[\s\S]*?TO anon[\s\S]*?WITH CHECK \(user_id IS NULL\)/i.test(
        migrationSql,
      ) &&
      /CREATE POLICY "Users submit own tickets"[\s\S]*?TO authenticated[\s\S]*?user_id = auth\.uid\(\)/i.test(
        migrationSql,
      ),
  ],
  [
    "support ticket inserts expose only form-required columns",
    /GRANT INSERT \(user_id, email, subject, message\)[\s\S]*?TO anon, authenticated/i.test(
      migrationSql,
    ) &&
      /DROP POLICY IF EXISTS "Anyone can submit ticket" ON public\.support_tickets/i.test(
        migrationSql,
      ),
  ],
);

for (const [label, passed] of checks) {
  assert.ok(passed, `Core workflow contract failed: ${label}`);
  console.log(`PASS ${label}`);
}
console.log(
  `PASS all ${checks.length} workflow contracts; ${migratedTables.size} migrated tables and ${referencedNames.size} Supabase .from() references inspected.`,
);
