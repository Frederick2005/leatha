# Leatha Repair and Development Plan

**Status:** Proposed sequence based on the static audit. Work is local-only until production access and approval are explicitly provided.

## Phase 0 — Credential containment
1. Treat the service-role credential included in the supplied `.env` as exposed.
2. Rotate it in Supabase and update only approved deployment secret stores.
3. Confirm `.env`, `.env.*` (except `.env.example`), and local secret files are ignored by Git and excluded from distributable archives.
4. Remove all `VITE_` fallbacks for LiveKit API secrets.

**Data impact:** none. **External approval:** required to rotate live credentials.

## Phase 1 — Authorization emergency repairs
1. Disable or secure all three LiveKit token issuance paths; authenticate the caller and derive identity, room membership, room type, and host privilege from trusted records.
2. Replace unrestricted `calls` UPDATE policy and add call status/column transition enforcement.
3. Lock down `user_roles`: ordinary admins must not be able to grant/revoke admin or super-admin privileges; protect UPDATE as well as INSERT/DELETE.
4. Protect profile fields (`account_type`, `is_verified`, points, XP, level, streaks) from direct user mutation.
5. Restrict custom-option writes and teacher-school approval transitions.

**Migration approach:** additive/reversible migrations where possible; preserve existing rows. Test in a local/staging Supabase project before production. Never apply to production without explicit approval.

## Phase 2 — Authentication and server boundaries
1. Define one trusted server-side auth helper for API routes and server functions.
2. Ensure all privileged server functions verify Supabase JWTs and authorize the specific action/resource.
3. Replace browser-side privileged writes with server functions or narrow database RPCs.
4. Review account-type metadata; allow only `student` and `teacher` at signup, and never infer admin authority from profile metadata.
5. Add rate limits and request-size/schema limits to public endpoints and edge functions.

## Phase 3 — Database and storage integrity
1. Review all 60 tables, 190 policies, 23 functions, and 34 triggers for effective permissions, not merely RLS enablement.
2. Audit Storage buckets for public/private classification, path ownership, content-type/size limits, and delete/update permissions.
3. Add constraints for status enums, nonnegative counters, relationships, and uniqueness where supported by current data.
4. Add indexes for observed high-volume filters and joins after query-plan review.
5. Add audit logging for privileged changes, with server-generated actor IDs and immutable event details.

## Phase 4 — Core workflows
1. Complete assignment workflows (creation, distribution, submission, feedback, grading) if confirmed as product priority.
2. Verify lesson fork lineage, attribution, diff behavior, and permission checks.
3. Complete school onboarding and teacher verification with explicit approval transitions.
4. Verify Arena scoring, challenge answer validation, rewards, and anti-tampering on the server.
5. Verify appointment and payment workflows against provider webhooks; do not mark payments successful from browser input.

## Phase 5 — Product expansion
1. Design physical-books commerce as a distinct domain: listings, seller ownership, inventory, orders, payment intents, fulfillment, refunds, and audit trail.
2. Define the Jarvis assistant scope, privacy boundaries, retention policy, and cost budget before choosing a provider.
3. Add missing user-facing assignment and commerce routes only after the domain model and security boundaries are approved.

## Phase 6 — Reliability and UX
1. Remove caching of private Supabase API responses; test offline behavior and multi-account switching.
2. Fix PWA icon references and verify installability.
3. Add structured server logging, error monitoring, backup/restore procedures, and deployment checks.
4. Perform responsive/accessibility review after security-critical work.

## Phase 7 — Test and deploy
1. Install dependencies in an environment with npm registry access and run `tsc`, ESLint, and production build.
2. Add unit and integration tests for each security repair.
3. Run student, teacher, moderator, admin, and super-admin E2E journeys.
4. Run RLS tests using multiple user identities and verify negative authorization cases.
5. Prepare staging deployment and rollback instructions.
6. Obtain explicit approval before production migration or deployment.

## Rollback principles
- Use new migrations with explicit rollback scripts where feasible.
- Back up data before schema changes.
- Never drop or rewrite existing user data as part of routine repairs.
- Do not rotate production secrets, apply production migrations, or deploy without approval.


## User-workflow-first priority update (2026-11-20)

1. **Feedback workflow — repair prepared:** reconcile the conflicting feedback table definitions; add missing `category` and `status` fields; align the feedback form, admin panel, and generated types. Apply the migration only after confirming the target database migration state.
2. **End-to-end workflow audit:** trace every user-visible action from form validation through Supabase write, RLS policy, related records, and success/error UI.
3. **Schema completeness:** compare every application table/column use against the effective ordered migration schema and generated types; distinguish genuinely missing SQL fields from stale type declarations.
4. **Workflow reliability:** repair ignored query errors, partial saves, orphaned storage uploads, and actions that report success before persistence is confirmed.
5. **Role-specific acceptance tests:** student, teacher, school administrator, moderator, and administrator journeys.


## Newly identified workflow blockers

- **P1 — Feedback submission/moderation:** repaired locally through additive migration and application/type alignment.
- **P1 — Appointment embedded profile joins:** additive `public.profiles` FK relationships prepared; validate legacy rows and refresh PostgREST schema cache after migration.
- **P1 — Teacher booking notification:** moved notification creation to an `AFTER INSERT` database trigger because authenticated clients cannot insert notifications.
- **P1 — Teacher pricing currency:** primary discovery/booking flow now uses the configured teacher currency; test with USD and UGX data before release.
- **P2 — Payment UX honesty:** automatic mobile-money prompt language removed until a real provider integration and webhook exist.

## Local implementation status update — 2026-11-20

| Work item | Local status | What remains |
|---|---|---|
| Feedback schema/UI reconciliation | Implemented locally | Apply migration and test in staging |
| Explicit profile foreign-key joins | Implemented locally | Check legacy orphans, validate constraints, refresh PostgREST schema cache |
| Appointment notification persistence | Implemented locally | Verify insert trigger and notification UI in staging |
| Documents Storage bucket and visibility | Implemented locally | Apply migration; test owner/student/public access and signed URLs |
| Teacher onboarding/discovery profile | Implemented locally | Run student/teacher onboarding E2E |
| Custom-option persistence and permissions | Implemented locally | Run RPC and RLS tests |
| Teacher-school approval flow | Implemented locally | Run teacher/school-admin/moderator RLS tests |
| Calls UPDATE policy | Implemented locally | Run negative authorization tests |
| Profile and teacher aggregate guards | Implemented locally | Test trigger privilege context and admin workflows in PostgreSQL |
| LiveKit token issuance | Implemented locally in API, Edge Function, and server function | Test with staging Supabase/LiveKit credentials; verify deployed function versions |
| Absolute-controller and role UPDATE protection | Pending | Critical next database security milestone |
| Assignments, Arena server-side scoring, commerce | Pending | Full feature/workflow audit and implementation |

No production changes have been made. Treat all “implemented locally” entries as source changes awaiting database/runtime verification, not as deployed fixes.


## Additional core workflow improvements prepared

- **P1 — Document storage bucket and visibility:** create/configure a private bucket; align object-level and metadata-level visibility; preserve cleanup on failed uploads.
- **P1 — Teacher discovery correctness:** require profile verification before listing a teacher as bookable; retain onboarding experience text and populate the numeric teacher profile experience field.
- **P2 — Availability slot correctness:** preserve non-hour start minutes, ensure one-hour sessions fit fully, check interval overlap, and surface load errors.
- **P1 outstanding — Timezone correctness:** booking must convert teacher-local availability to student-local display and store the correct absolute instant.

| Privileged role mutation guard | Implemented locally | Apply in staging; test ordinary-admin escalation attempts and final-super-admin invariant |
| Absolute-controller initial owner designation | Pending human decision | Identify and verify the intended owner account; use a trusted database bootstrap, not public signup or a frontend flag |
- The role-guard migration also updates `is_mod_or_admin()` and `user_roles` RLS so a distinct super-admin has the access the admin UI requires; test this with a super-admin-only test identity.
