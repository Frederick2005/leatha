# Leatha Implementation Log

## 2026-11-20 — Initial takeover and static discovery

- Opened the supplied ZIP and extracted a working copy for inspection.
- Confirmed React 19, TypeScript, Vite 7, TanStack Router/Start, Supabase, Ant Design, Radix UI, Tailwind CSS 4, LiveKit, and Cloudflare Wrangler.
- Counted 55 route files and 24 SQL migrations.
- Inspected token-generation paths, authentication middleware, role management, RLS policies, PWA service worker, and payment/appointment guard migrations.
- Created `ENGINEERING_AUDIT.md`, `REPAIR_PLAN.md`, `ARCHITECTURE.md`, `DATABASE_AUDIT.md`, `SECURITY_AUDIT.md`, `TESTING_REPORT.md`, and `DEPLOYMENT_GUIDE.md`.
- No application code or database migration has been changed/applied yet.

### Verification
- Static repository inspection: completed for the high-risk areas documented in the audit.
- Dependency installation: blocked; npm registry DNS returned `EAI_AGAIN` and `npm ci` timed out.
- TypeScript/build/lint/tests: not run because dependencies are not installed.
- Production services: not accessed.

### Tracker

| Issue ID | Description | Priority | Status | Files / objects | Verification |
|---|---|---:|---|---|---|
| LTH-SEC-001–003 | LiveKit token authorization | Critical | Pending | API route, server function, Edge Function | Static defect confirmed; runtime test pending |
| LTH-SEC-004 | Unrestricted call updates | Critical | Pending | `calls` RLS policy | SQL policy inspected; DB test pending |
| LTH-SEC-005 | Role update escalation | Critical | Pending | `user_roles`, role trigger | Migration logic inspected; DB test pending |
| LTH-SEC-006 | Sensitive profile fields mutable | High | Pending | `profiles` RLS | SQL policy inspected; DB test pending |
| LTH-SEC-007 | Broad custom-option updates | High | Pending | `custom_options` RLS | SQL policy inspected; DB test pending |
| LTH-SEC-008 | Teacher can update membership status | High | Pending | `teacher_schools` RLS | SQL policy inspected; DB test pending |
| LTH-SEC-009 | `.env` included in archive | High | Requires human approval | `.env`, secret stores | Credential is populated; rotation not performed |
| LTH-SEC-010 | Vite-prefixed LiveKit secret fallback | High | Pending | LiveKit token paths | Static references confirmed |
| LTH-PWA-001 | Private REST response caching | High | Pending | `public/sw.js`, `vite.config.ts` | Static cache logic inspected |
| LTH-PWA-002 | PWA icon path mismatch | Medium | Pending | `vite.config.ts`, `public/icons` | File/path comparison completed |

Statuses are intentionally not marked Fixed or Verified because no repairs have yet been applied.
- Applied one low-risk configuration correction: Vite-generated PWA manifest icon paths now point to existing `public/icons/icon-192.png` and `public/icons/icon-512.png` assets. This is **not yet verified** because dependencies could not be installed.
- Applied a privacy hardening change: removed Workbox runtime caching rules for Supabase REST and Storage responses, and changed the custom service worker to bypass all `supabase.co` traffic without caching. This avoids retaining authenticated API responses or private Storage objects in shared browser caches. **Not build/runtime verified** because npm dependencies remain unavailable.


## 2026-11-20 — User workflow and feedback data integrity

### Implemented locally (not yet runtime-verified)

- Added `supabase/migrations/20261120113000_reconcile_feedback_workflow.sql` to add the missing `feedback.category` and `feedback.status` columns with safe defaults, a status check constraint, and a supporting index. Existing feedback records and legacy columns are preserved.
- Updated `src/routes/feedback.tsx` to persist the optional contact separately and use the existing `message` field.
- Updated `src/routes/admin.tsx` to display the actual `message` column and check the result of feedback updates before showing success.
- Updated `src/integrations/supabase/types.ts` to reflect the effective feedback schema (`message`, `contact`, `category`, `status`, and the moderation fields).

### Verification

- Static inspection confirms the conflicting duplicate `CREATE TABLE IF NOT EXISTS public.feedback` definitions and the missing fields in the effective first-created schema.
- The new migration is additive and idempotent for its columns, constraint creation, and index.
- No live database migration has been run.
- TypeScript/build/test execution remains blocked because dependencies are not installed and npm registry access previously failed.


### Additional user-workflow repairs prepared

- Added `20261120120000_add_profile_relationship_foreign_keys.sql` with supplemental `public.profiles` foreign keys for appointments, teacher profiles, Arena participants, endorsements, suggestion upvotes, and lesson-suggestion authors/claimers. Existing `auth.users` constraints are preserved; new constraints are `NOT VALID` pending a live data-integrity check.
- Updated the matching PostgREST relationship names in appointment, earnings, Arena, and profile queries, and updated the generated TypeScript relationship metadata.
- Added `20261120123000_notify_teacher_on_appointment.sql`; teacher notifications are now created by a database trigger using the actual `notifications` schema, rather than a blocked/incorrect browser insert.
- Updated teacher discovery and booking to use the teacher's configured currency. Fixed the student dashboard query to stop selecting the nonexistent `hourly_rate` column.
- Corrected the payment dialog so it does not claim an automatic mobile-money prompt was sent when no provider API is integrated.

### Verification still outstanding

- SQL migrations have only been statically reviewed; they have not been applied to a Supabase instance.
- `NOT VALID` foreign keys require legacy orphan checks and later validation.
- End-to-end appointment, notification, and payment-intent flows require a test Supabase project and test accounts.

- Static schema cross-check: all 44 distinct application `.from(...)` table references have corresponding table-creation migrations; 60 effective SQL table schemas were compared with generated `Row` types. The feedback mismatch was reconciled; no remaining table-column mismatches were detected by the static comparison.
- Static relationship cross-check: explicit application profile embeds now map to declared foreign-key names in the prepared migration set.
- TypeScript transpile syntax check passed for 11 changed TS/TSX files. Full project `tsc` is blocked because `vite/client` is unavailable without installed dependencies; no build/lint/E2E claim is made.

## 2026-11-20 — Core workflow reliability and data-integrity repairs

### Implemented locally

- Added `20261120130000_repair_core_user_workflows.sql`:
  - Creates the missing `documents` Storage bucket as private, with a 20 MB limit and the file types accepted by the UI.
  - Replaces owner-only document object reads with storage authorization aligned to document visibility and confirmed/completed teacher-student appointments.
  - Restricts teacher-school requests to `pending`; only school administrators/moderators/admins can approve or reject them, and membership identity fields are immutable.
  - Replaces unrestricted `calls` UPDATE with host-only UPDATE.
  - Removes broad `custom_options` UPDATE and adds atomic `record_custom_option(category, value)` RPC.
  - Replaces the signup trigger to cast account type correctly, allow only student/teacher self-selection, and persist grade/subject metadata.
  - Protects profile verification and achievement counters from direct user edits, while allowing the admin panel to update profiles under an explicit RLS policy.
  - Protects teacher rating/earnings aggregates from self-editing.
- Updated `src/routes/documents.tsx` to validate file extension and size, use unique safe storage keys, roll back an uploaded object if its metadata insert fails, report load errors, request signed download URLs, and avoid a public URL for private files.
- Updated `src/routes/onboarding.tsx` to create/update the teacher discovery profile during teacher onboarding without resetting an existing rate or experience value.
- Updated `src/components/dynamic-select.tsx` to persist custom options through the narrow RPC rather than arbitrary row updates.
- Updated `src/routes/dashboard-route.tsx` so a profile's `account_type` value alone cannot display the administrator dashboard preview.
- Secured the active API token route, the Supabase Edge Function, and the TanStack server function for direct-message calls. Each requires a verified Supabase user, validates the DM room against the caller and other participant, derives participant identity from the verified user, and never accepts a caller-supplied host flag.
- Added `scripts/check-core-workflows.mjs` and `npm run test:contracts` for source-level checks that app table/bucket references have migrations and key workflow contracts remain aligned.

### Verification

- `node scripts/check-core-workflows.mjs`: **passed 12/12 checks**, including all 47 `.from(...)` references against 60 migrated tables and declared storage buckets.
- Global TypeScript parser pass: no TypeScript syntax diagnostics in changed files. Full project type-check remains blocked because project dependencies and `vite/client` are unavailable.
- `npm ci`, ESLint, production build, browser tests, PostgreSQL migration execution, RLS tests, and live Supabase/LiveKit checks remain **not verified**. No production migration or deployment has been performed.

### Remaining blockers

- Apply and test the new migrations on a disposable/staging Supabase project; check existing bucket configuration and legacy foreign-key rows first.
- Complete the independent `user_roles` UPDATE / permanent absolute-controller protection repair.
- Review and complete assignment submission/grading workflows, Arena server-side scoring, and teacher verification transitions.
- Payment provider integration is not present; payment intents remain records of pending attempts, not proof of payment.


### Further core workflow repairs prepared

- Added `20261120130000_repair_core_user_workflows.sql`: creates/configures the private documents bucket; aligns storage visibility with document metadata; restricts teacher-school membership updates; restricts call updates to the host; replaces broad custom-option updates with a validated RPC; hardens signup account-type metadata and privileged profile fields; protects teacher aggregate fields.
- Wired `DynamicSelect` to the `record_custom_option` RPC.
- Improved document load/delete/upload error handling, added file validation before the busy state, and retained object cleanup if metadata save fails.
- Teacher discovery and student dashboard now show only verified teachers; teacher onboarding initializes the `teacher_profiles` record and preserves experience range while populating the numeric experience field.
- Booking slots now preserve minute offsets, require the full one-hour session to fit, exclude overlapping appointments, and report availability lookup failures.
- Remaining known issue: the booking modal does not yet convert between teacher and student timezones.


### Onboarding, discovery, and availability follow-up

- Teacher onboarding now maps the selected experience range into `teacher_profiles.years_experience`; the original range remains in `profiles.experience`.
- The core workflow migration backfills missing teacher profile rows for legacy teacher accounts without overwriting existing teacher profiles.
- Teacher discovery and the student dashboard now filter to verified teachers and handle profile lookup failures.
- Booking slot generation preserves minute offsets, offers only complete one-hour slots, checks interval overlaps, and surfaces availability query errors.
- Document upload validation now occurs before the busy state is set, preventing invalid file selections from leaving the dialog permanently busy.
- Full source syntax transpile passed for 148/148 TypeScript and TSX files. Full type checking remains blocked by missing `vite/client` definitions because dependencies could not be installed.

### Privileged role mutation protection

- Added `20261120131000_protect_role_mutations.sql` to run the role guard on INSERT, UPDATE and DELETE.
- Ordinary authenticated admins cannot create, promote, demote, transfer or remove admin/super-admin role rows. The final `super_admin` cannot be demoted or deleted through the application.
- Trusted database/service-role operations and the existing first-user bootstrap remain possible.
- The migration deliberately does not guess which user should own the permanent controller. Initial `super_admin` designation must be performed by a trusted database owner after the owner account is explicitly identified.
- Static contract suite now passes 16/16 checks. PostgreSQL behavior still needs staging verification.

- Added a document metadata identity trigger to prevent owners from repointing their public document record at another user's Storage object. Upload MIME type is now derived from the validated extension to match the private bucket's allowed MIME list.
- Extended `is_mod_or_admin()` and the `user_roles` read/manage policies so a super-admin account has the platform-wide moderation/role visibility expected by the UI even if it does not separately carry the ordinary `admin` role.

## 2026-11-21 — Security follow-up and local verification

### Additional security changes implemented locally

- Added `20261121150000_blocked_dm_call_protection.sql`. Its interaction function checks blocks in both directions and rejects self-interaction or nonexistent profiles. The direct-message INSERT policy uses this function.
- Updated all three LiveKit token issuance paths to reject blocked participants through the database authorization check.
- Updated messaging behavior to handle mutual blocks, fail closed on authorization errors, prevent blocked DM/call actions, and close an active call when blocking.
- Added `20261121160000_secure_support_ticket_submissions.sql`. Guest submissions require a null user ID; authenticated submissions must use the caller's own ID. INSERT privileges are restricted to the four support-form columns.
- Updated workflow contract checks for mutual-block enforcement and support-ticket restrictions.

### Local verification — 2026-11-21

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed with 0 errors and 10 warnings |
| `npm run build` | Passed; large-chunk warnings remain |
| `npm run test:contracts` | Passed, 25/25 contracts |
| `git diff --check` | Passed; line-ending conversion warnings only |

The contract suite reports that 60 migrated tables and 47 Supabase `.from()` references were inspected.

### Remaining verification and deployment work

- All seven new migrations require review against the target database's actual migration history and schema, followed by testing on a disposable or staging Supabase project.
- PostgreSQL execution, real-role RLS behavior, Storage access, LiveKit integration, and browser end-to-end workflows remain unverified.
- No production migration or deployment is claimed.
- The permanent absolute-controller account still needs explicit trusted database-owner designation.
- Assignment/grading, Arena server-side scoring, commerce, and payment-provider workflows remain areas for further implementation and testing.
