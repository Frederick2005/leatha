# Leatha Security Audit

## Scope and limitations

Static review of supplied source and SQL migrations only. No external endpoint or production environment was probed. Findings describe unsafe implementation patterns in the archive, not proof that a deployed instance was exploited.

## Critical findings

### SEC-001–003: LiveKit token issuance trusts caller privileges

Affected:
- `src/routes/api/-get-token.ts`
- `src/lib/livekit.functions.ts`
- `supabase/functions/get-livekit-token/index.ts`

All three implementations accept some combination of room name, identity/name, or host status from the request. The API route and Edge Function do not verify a Supabase caller before signing. The TanStack server function also lacks auth middleware and trusts `isHost`. The API route may grant `roomAdmin` based on the request body. One secure implementation must derive identity, room, participant eligibility, and host rights from trusted server-side records.

### SEC-004: Calls RLS permits arbitrary authenticated updates

Affected: `supabase/migrations/20260604200715_8e2ba0ea-93b0-498c-8c4e-fd84f2782d77.sql`.

The UPDATE policy uses `USING (true) WITH CHECK (true)`. Replace with owner/participant constraints and a trigger for legal transitions and immutable fields.

### SEC-005: Role UPDATE is not protected

Affected: initial `user_roles` policies and role-protection migrations dated 2026-05-05 and 2026-05-04.

The trigger is created for INSERT OR DELETE, not UPDATE. An admin `FOR ALL` policy exists. The trigger must protect all mutation paths, and ordinary admins should not be able to edit protected role rows. A permanent controller should not depend on a client-editable flag or ordinary role row update.

## High findings

- `profiles` own-row UPDATE policy exposes sensitive profile/status/progression columns to direct user mutation.
- `custom_options` has unrestricted authenticated UPDATE.
- `teacher_schools` permits broad updates by teacher or school admin without status-specific authorization.
- `teacher_verifications` update policy lacks state-transition/reviewer-field enforcement.
- `public/sw.js` caches Supabase REST responses without excluding private authenticated data.
- `.env` included in the archive contains a populated Supabase service-role key. Rotate it if this archive has been distributed beyond the intended trusted environment.
- LiveKit server code accepts `VITE_LIVEKIT_API_SECRET` fallback. Never expose secrets under the Vite public prefix.

## Medium findings

- Three token-generation implementations have divergent permissions and TTLs.
- Admin role changes are initiated from browser code; database policy currently provides insufficient separation.
- Automated security tests are absent.
- PWA manifest references icon paths not found in the archive.

## Recommended control model

1. Browser receives only Supabase publishable/anon key.
2. Server verifies Supabase access token and derives the subject from validated claims.
3. Server checks resource-specific membership and role using trusted database state.
4. Sensitive state changes occur through narrow server functions/RPCs.
5. RLS remains enabled as defense in depth and is tested using real role-specific sessions.
6. Audit records are server-generated and append-only for privileged operations.
7. Secrets live only in server-side environment/secret stores and never in Vite-prefixed variables.

## Local remediation applied (not yet runtime verified)

- Removed Workbox runtime caching for Supabase REST and Storage responses.
- Updated the custom service worker to bypass all Supabase host traffic rather than caching REST or Storage responses.
- Removed Vite-generated PWA manifest icon path mismatch.

These changes are present in the audit copy only; they have not been deployed.

## Local remediation update — 2026-11-20 (not runtime verified)

- The active `/api/get-token` route now requires a verified Supabase bearer token, derives participant identity from the verified user, validates the direct-message room against the authenticated user and the other participant, and never accepts host privilege from the request body.
- The Supabase `get-livekit-token` Edge Function now applies the same authentication and direct-message room checks.
- The TanStack server function now uses `requireSupabaseAuth`, validates the direct-message room, and derives identity from authenticated context.
- The `calls` UPDATE policy is now host-only.
- `teacher_schools` requests must start pending; approval is limited to authorized school/platform administrators.
- Profile verification and achievement counters and teacher reputation/earnings aggregates are guarded against direct self-editing.
- `custom_options` no longer grants unrestricted UPDATE; an atomic validated RPC is used instead.

The ordinary-admin role mutation guard is implemented in the local migration set, including INSERT, UPDATE, and DELETE protection for privileged role records. The permanent absolute-controller account has not been designated and still requires an explicit trusted-owner decision. No live database or endpoint test has been run.

### Local remediation: privileged role mutation guard

`20261120131000_protect_role_mutations.sql` replaces the earlier INSERT/DELETE-only trigger with an INSERT/UPDATE/DELETE guard. Ordinary authenticated admins cannot create or modify admin/super-admin role records. The final super-admin cannot be demoted or deleted through the application. Trusted service/database administration remains the recovery path. The migration does not automatically choose an absolute-controller account; that requires an explicit owner identity and trusted bootstrap action.
- The same role migration updates `is_mod_or_admin()` to include `super_admin` and grants the super-admin role explicit RLS visibility/management of `user_roles`, while the trigger prevents ordinary admins from mutating privileged rows.

## Local security remediation update — 2026-11-21

### Mutual block enforcement

- Added `20261121150000_blocked_dm_call_protection.sql` with an interaction check that rejects blocked relationships in either direction.
- The direct-message INSERT policy invokes this function, enforcing the restriction independently of the interface.
- The API route, TanStack server function, and Supabase Edge Function for LiveKit token issuance check the same authorization condition.
- The messaging interface handles blocked relationships and fails closed when authorization cannot be completed.

### Support-ticket submission restrictions

- Added `20261121160000_secure_support_ticket_submissions.sql`.
- INSERT privileges are limited to `user_id`, `email`, `subject`, and `message`.
- Guest submissions require a null `user_id`; authenticated submissions must use their own authenticated user ID.

### Current local verification

- TypeScript project check passed.
- ESLint passed with zero errors and 10 warnings.
- Production build passed with large-chunk warnings.
- All 25 static workflow contract checks passed.
- `git diff --check` passed.

### Outstanding security verification

- The seven new migrations have not been confirmed as applied to staging or production.
- PostgreSQL execution and RLS behavior require tests using guest, authenticated, teacher, moderator, admin, and super-admin sessions as applicable.
- LiveKit authorization requires configured test services and authenticated test identities.
- Storage access and private-document visibility need integration tests.
- The permanent absolute-controller account still requires explicit trusted database-owner designation.
- No production deployment, production smoke test, or complete browser end-to-end test is claimed.
