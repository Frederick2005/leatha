# Leatha Testing Report

## Current status — updated 2026-11-21

| Check | Status | Result |
|---|---|---|
| Repository inventory | Completed | Application routes, migrations, and high-risk areas inspected |
| TypeScript project check | Passed | `npx tsc --noEmit` completed successfully |
| ESLint | Passed with warnings | 0 errors; 10 React Refresh warnings |
| Production build | Passed with warnings | Client and SSR builds completed; large-chunk warnings remain |
| Workflow contract suite | Passed | 25/25 static contracts passed |
| Database schema/reference inspection | Passed statically | 60 migrated tables and 47 Supabase `.from()` references inspected |
| `git diff --check` | Passed | No whitespace errors; line-ending conversion warnings only |
| PostgreSQL migration execution | Not run | No staging database migration execution confirmed |
| RLS and Storage integration tests | Not run | Requires a controlled Supabase test environment |
| LiveKit integration tests | Not run | Requires configured test services and authenticated test identities |
| Browser / end-to-end tests | Not run | No completed end-to-end test run confirmed |
| Production smoke tests | Not run | No production deployment or smoke test claimed |

Local source checks passed, but they do not establish that database migrations, RLS policies, Storage permissions, or production integrations work at runtime.

## Required test plan

### Unit
- Room permission derivation for each room type and account role.
- Role transition validator and protected-controller invariants.
- Appointment/payment transition validators.
- Input schema validation and request limits.

### Database integration
- Student cannot update own `is_verified`, `account_type`, points, XP, or role.
- Teacher cannot approve their own teacher-school membership.
- Non-host cannot update a call or grant themselves room privileges.
- Ordinary admin cannot create, promote, update, or delete super-admin roles.
- Payer cannot mark payment successful; only trusted webhook/service path can.
- Users cannot update unrelated custom options.

### End-to-end
- Student registration, email verification, login, onboarding, learning, discussion, logout.
- Teacher registration, onboarding, school membership request, content publication, assignment workflow.
- Moderator/admin moderation and school verification.
- Super-admin protected operations and recovery process.
- Appointment booking, cancellation, completion, payment webhook result.
- Arena attempt scoring and anti-tampering.
- Offline PWA behavior and account switching after sign-out.

## Exit criteria

A repair is marked Verified only after relevant tests pass in a controlled environment. A successful compile alone is not sufficient.

## Source-level changes and remaining runtime verification

- PWA manifest icon paths and Supabase REST/Storage cache-bypass changes are included in the current source.
- The current source passes the TypeScript project check, ESLint (with 10 warnings), production build, and 25 workflow contract checks.
- Browser behavior, database migration execution, RLS, Storage access, and live service integration remain unverified.

## Historical user-workflow checks — 2026-11-20

The results below are a historical snapshot from 2026-11-20, before the latest dependency installation and verification run. They are retained for audit history; the current results are in the status table at the top of this report.

| Check | Status | Result |
|---|---|---|
| Application table references vs migrations | Static check passed | All 43 distinct `.from(...)` table references have a `CREATE TABLE` migration in the supplied repository. |
| Effective SQL columns vs generated Row types | Static check passed | 60 tables compared after respecting the first `CREATE TABLE IF NOT EXISTS` definition and subsequent `ALTER TABLE ADD COLUMN` statements; no remaining column mismatches after the feedback type reconciliation. |
| Explicit PostgREST profile relationship names | Static check passed | All application `profiles!foreign_key(...)` selectors now have matching migration constraints in the supplied source. |
| TypeScript/TSX syntax | Passed | TypeScript `transpileModule` syntax transpilation passed for all 148 TS/TSX source files. |
| Full TypeScript project check | Blocked | `tsc --noEmit -p tsconfig.json` cannot resolve `vite/client` because project dependencies are not installed. |
| SQL migration execution | Not run | No test Supabase/PostgreSQL connection was available. |
| Appointment and feedback E2E | Not run | Requires a test Supabase project and test accounts. |

The checks above are static/source checks, not runtime verification. The additive migrations still need to be applied to a non-production Supabase project first, followed by RLS, relationship, trigger, and user-journey tests.

## Historical core workflow checks — 2026-11-20

The results below record the earlier 2026-11-20 verification state. They are superseded by the current 25/25 contract result and the current TypeScript, ESLint, and production-build results recorded above.

| Check | Status | Result |
|---|---|---|
| `node scripts/check-core-workflows.mjs` | Passed | 12/12 checks passed; 60 migrated tables and 47 `.from(...)` names inspected, including Storage bucket names. |
| Changed TypeScript syntax parse | Passed with limitation | No TS1xxx syntax diagnostics; module/type resolution cannot complete without installed packages and Vite types. |
| Full TypeScript check | Blocked | `vite/client` and package dependencies unavailable. |
| ESLint / production build | Not run | Dependencies are not installed. |
| SQL execution / RLS tests | Not run | No local PostgreSQL or test Supabase connection is available. |
| Document upload/download E2E | Not run | Requires staging Storage and authenticated test accounts. |
| LiveKit token endpoint E2E | Not run | Requires configured LiveKit credentials and test Supabase identity. |


The syntax transpile check parses source files but does not perform full type checking. `tsc --noEmit -p tsconfig.json` was attempted after edits and stops immediately because `vite/client` type definitions are unavailable without installed dependencies.

- The contract suite now includes the privileged-role mutation guard and final-super-admin protection; **16/16 static contracts pass**. This does not yet prove PostgreSQL trigger execution or RLS behavior in a real Supabase project.
