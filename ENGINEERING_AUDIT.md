# Leatha Engineering Audit

**Audit basis:** `leatha-test (1).zip`, inspected 2026-11-20.
**Scope:** static repository inspection only. No production Supabase project, LiveKit project, payment-provider account, or deployed environment was accessed.
**Status:** Phase 1 static discovery substantially complete; runtime verification blocked because dependency installation could not reach the npm registry.

## Executive summary

Leatha is an existing React 19 / TypeScript educational social-learning application using Vite 7, TanStack Router/Start, Supabase Auth/Postgres/Storage, Ant Design, Radix UI, Tailwind CSS 4, LiveKit, and Cloudflare Wrangler. The archive contains 55 route files, 24 SQL migration files, and substantial functionality for profiles, lessons and forks, messaging, appointments, schools, teacher workflows, moderation, and Leatha Arena.

The project should be repaired incrementally. The highest risks are authorization defects in LiveKit token issuance, role management, call records, and mutable profile fields. The archive also contains a populated `.env` file with a service-role credential; do not redistribute it. No credentials are reproduced in this report.

## Confirmed defects from static inspection

| ID | Severity | Evidence | Impact | Recommended repair |
|---|---|---|---|---|
| LTH-SEC-001 | Critical | `src/routes/api/-get-token.ts`: request body controls `participantIdentity` and `isHost`; no authentication or room membership check is performed before token signing. | Unauthenticated callers can request participant tokens and host-level room grants. | Require verified Supabase identity; load the room and membership from trusted records; derive identity and host permissions server-side; deny unknown room types. |
| LTH-SEC-002 | Critical | `supabase/functions/get-livekit-token/index.ts`: accepts `isHost`, `username`, `displayName`, and `roomName` from JSON; no caller JWT verification is present. CORS allows `*`. | Edge token endpoint trusts caller-controlled identity and privilege. | Verify bearer JWT with Supabase Auth; authorize room membership and role; derive all claims server-side; restrict CORS to approved origins. |
| LTH-SEC-003 | Critical | `src/lib/livekit.functions.ts`: Zod input requires caller-supplied `isHost` and username; handler signs a six-hour JWT without auth middleware or authorization lookup. | A caller may request a host token through the server function. | Remove privilege-bearing input; authenticate and authorize inside the server handler; use LiveKit SDK rather than custom JWT signing. |
| LTH-SEC-004 | Critical | `supabase/migrations/20260604200715_8e2ba0ea-93b0-498c-8c4e-fd84f2782d77.sql`: policy `any authed update call status` uses `USING (true) WITH CHECK (true)`. | Any authenticated user can update any `calls` row, including host, room, and status fields. | Replace with host/participant-specific policies and a database trigger restricting mutable columns and valid status transitions. |
| LTH-SEC-005 | Critical | `supabase/migrations/20260423021228_77692987-3ce5-4fe1-92e9-cdc58338525e.sql`: `Admins manage roles` is `FOR ALL`; later `super_admin` protection triggers cover INSERT and DELETE but not UPDATE (`20260505164411...sql`, `20260504162806...sql`). | An ordinary admin may be able to update an existing role row and promote privileges because UPDATE is not protected by the trigger. | Restrict role table writes to a trusted server operation; add update protection and enforce absolute-controller rules in the database. Test all role transitions. |
| LTH-SEC-006 | High | `supabase/migrations/20260423021228_77692987-3ce5-4fe1-92e9-cdc58338525e.sql`: profile UPDATE policy checks only `auth.uid() = id`. `profiles` contains `account_type`, `is_verified`, points and progression fields. | Users can potentially change their own verification, account-type, and game/progression fields directly through Supabase. | Restrict writable columns through server functions or triggers; separate public profile fields from protected status and score fields. |
| LTH-SEC-007 | High | `supabase/migrations/20260701073709_feb99ebb-bbd5-46cb-8f88-28de08eb999b.sql`: `Authenticated can bump usage` permits UPDATE with `USING (true) WITH CHECK (true)`. | Any authenticated user can alter arbitrary `custom_options` columns, not only usage count. | Replace with a narrowly scoped RPC/trigger that increments usage_count for an existing option; prevent changes to category/value/creator. |
| LTH-SEC-008 | High | `supabase/migrations/20260504162806_9a83ea1f-1a2d-44bf-8427-19eda1c04edb.sql`: teacher-school UPDATE policy allows either teacher or school admin based on row ownership, without limiting columns or status transitions. | A teacher may be able to approve their own school membership by changing status. | Enforce teacher-request vs school-admin-review transitions in a trigger or trusted server function. |
| LTH-SEC-009 | High | `.env` is present in the supplied archive and `SUPABASE_SERVICE_ROLE_KEY` is populated. | The archive contains a privileged credential that bypasses RLS. | Treat the key as exposed to everyone who received the archive; rotate it in Supabase, update deployment secrets, and never include `.env` in shared archives. |
| LTH-SEC-010 | High | `src/routes/api/-get-token.ts` and `src/lib/livekit.functions.ts` explicitly fall back to `VITE_LIVEKIT_API_SECRET`. | A secret with the Vite public prefix may be exposed to client bundles depending on build configuration. | Remove all `VITE_` secret fallbacks; use server-only runtime bindings and validate build output for secret strings. |
| LTH-PWA-001 | High | `public/sw.js` caches Supabase REST GET responses in a shared Cache API cache and does not exclude authenticated/private responses. | Cached user-specific data may persist across sign-out/account changes or be served offline without a fresh authorization check. | Do not cache authenticated Supabase REST responses; cache only explicitly public resources; clear user-scoped caches on sign-out and test account switching. |
| LTH-DB-001 | High | `supabase/migrations/20260604200715...sql`: call participants can be read by all authenticated users; call row updates are unrestricted. | Call metadata and participant state are not sufficiently isolated. | Scope call/participant reads to participants, host, and approved public room metadata; validate joins server-side. |
| LTH-DB-002 | Medium | `teacher_verifications` update policy permits moderator/admin updates but does not enforce status transitions or protect reviewer fields at column level. | A privileged client may modify fields beyond a legitimate review decision. | Enforce allowed status transitions, reviewer identity, and reviewed_at in a trigger or server function. |
| LTH-PWA-002 | Medium | `vite.config.ts` references `/icons/icon-192x192.png` and `/icons/icon-512x512.png`; archive contains `icon-192.png` and `icon-512.png` instead. | Generated PWA manifest icon requests may 404. | Align Vite PWA manifest icon paths with files in `public/icons`. |
| LTH-ARCH-001 | Medium | Three LiveKit token implementations exist: API route, TanStack server function, and Supabase Edge Function. | Authorization and token lifetime/permission rules can diverge; one repair may leave another vulnerable. | Consolidate to one server-authorized token service and remove/disable redundant issuance paths after call-site migration. |
| LTH-ARCH-002 | Medium | `src/integrations/supabase/auth-middleware.ts` and `client.server.ts` provide server auth/admin clients, but repository search found no application call sites using them. | Server-side infrastructure appears disconnected from the main browser-first data access pattern. | Adopt server functions for privileged operations; retain direct client access only for data protected by well-designed RLS. |
| LTH-QA-001 | Medium | `package.json` contains only dev/build/lint/format scripts; no unit, integration, or E2E test scripts. | Important authorization and workflow regressions have no automated test coverage. | Add Vitest and focused RLS/authorization integration tests; add Playwright journeys after core security repairs. |

## Product completeness findings

| Requirement | Static evidence | Status |
|---|---|---|
| Student/teacher profiles and dashboards | `src/routes`, `src/components/dashboards` | Implemented, requires runtime verification |
| Educational publishing and lesson forks | `lessons.*` routes, lesson tables and fork logic | Implemented, requires workflow and attribution review |
| Messaging and community | `chat.tsx`, `messages*`, comments, follows | Implemented, requires abuse/privacy testing |
| Leatha Arena | `arena.*` routes, arena tables and runner | Substantial implementation present; verify server-side scoring and attempt integrity |
| School/teacher relationships | `schools.tsx`, `teacher_schools`, `teacher_verifications` | Partial; self-approval and workflow restrictions need repair |
| Assignments | `class_assignments` schema/type evidence | Database object exists; no dedicated assignment route/workflow was found in the route inventory |
| Physical books and commerce | No books/products/orders/inventory/checkout implementation found | Missing |
| Jarvis-style AI | No AI provider or assistant integration found | Missing; no paid dependency should be added without approval |
| Absolute controller | `super_admin` enum, helper and trigger exist | Incomplete/unsafe; bootstrap grants `admin`, update path is not protected |
| Deployment and PWA | Cloudflare config, Vite PWA, manifest and service worker | Present but needs environment, cache, and asset-path repairs |

## Verification limitations

- No production database was queried.
- SQL migrations were statically inspected; they were not applied to a database.
- No Supabase, LiveKit, email, payment, or Cloudflare credentials were used to contact external services.
- `npm ci --ignore-scripts --no-audit --no-fund` timed out while fetching the npm registry (`EAI_AGAIN`); `node_modules` is unavailable. TypeScript, lint, and production build checks therefore remain unrun.
- No runtime exploit test has been performed. The findings above are code/policy defects evident from the supplied source, not claims of a successful attack against a live deployment.

## Small local change made after the audit

- `vite.config.ts`: corrected the generated PWA manifest's 192px and 512px icon paths to match files that actually exist in `public/icons/`.
- Verification: source/path comparison only. Build/install verification is blocked by npm registry DNS failure.
- `vite.config.ts` and `public/sw.js`: removed Supabase REST/Storage response caching. Source-level review confirms Supabase host traffic is now bypassed by the custom worker and is no longer listed in Workbox runtime caching. Runtime verification remains pending.

## Additional confirmed workflow defects — 2026-11-20

| ID | Severity | Evidence | User impact | Local remediation |
|---|---|---|---|---|
| LTH-WF-001 | High | The first feedback migration creates `message`/`contact`; a later `CREATE TABLE IF NOT EXISTS` assumes `body`/`category`/`status`, but does not alter the already-created table. The active form inserts `category`; the admin panel reads `body` and `status`. | Feedback submission can fail on `category`; admin moderation cannot reliably display message/status. | Additive migration adds category/status; form/admin/types now use the effective `message` field and dedicated contact. |
| LTH-WF-002 | High | Appointment, teacher-profile, Arena participant, suggestion, and endorsement queries request embedded `profiles` relationships that are not declared by the original SQL foreign keys. | PostgREST embedded selects can fail, breaking appointment lists/details, teacher pickers, earnings, Arena participant names, and profile endorsements. | Supplemental `public.profiles` foreign keys and matching type/query relationship names prepared with `NOT VALID`; existing rows still require validation. |
| LTH-WF-003 | High | Booking client attempted to insert `notifications.message` and `actor_id`; actual table has `body` and `related_id`, and authenticated role has no INSERT grant/policy. | Teacher may receive no notification even though booking succeeds; client ignored insert errors. | Notification is now generated by an `AFTER INSERT` database trigger using actual schema fields. |
| LTH-WF-004 | High | Teacher profile editor labels rates USD and `teacher_profiles.currency` defaults to USD, while teacher discovery/primary booking hard-coded UGX. | Rate may be displayed/recorded in a different currency from the configured teacher rate. | Discovery and primary booking now use the configured currency and rounded minor-unit amount. |
| LTH-WF-005 | Medium | Student dashboard selected `teacher_profiles.hourly_rate`, but the schema defines `hourly_rate_cents`. | Recommended-teacher query can fail and leave the dashboard empty. | Removed the nonexistent column from the dashboard query. |
| LTH-WF-006 | Medium | Payment dialog inserted a pending payment intent but claimed a mobile-money prompt would be sent; no provider request is made by this client flow. | Users can believe payment was initiated when only details were recorded. | Updated copy and confirmation to state manual payment is required until a provider integration exists. |

All local remediations remain unverified against a running Supabase environment. The foreign-key migration deliberately uses `NOT VALID`; inspect legacy orphan rows and validate constraints before marking the relationships fully verified.

## User-workflow-first remediation update — 2026-11-20

The initial static audit has been extended from table existence to actual workflow contracts. A corrected source scan finds all 60 uniquely discovered application tables in the migration history; the earlier suspected missing-table list was incorrect. Existing migrations already create those tables and several profile/analytics fields. The confirmed storage gap was the `documents` bucket, which had object policies but no bucket-creation migration.

Local repairs are now present for the documents upload/download lifecycle, teacher onboarding discovery record, custom-option persistence, teacher-school approval permissions, broad calls UPDATE, profile/teacher aggregate protections, and all three LiveKit token issuance paths. The exact files and limitations are recorded in `IMPLEMENTATION_LOG.md`. The new source contract suite passes 12/12 checks. These are not production-verification claims: dependencies could not be installed and no Supabase or LiveKit project was accessed.


| LTH-WF-007 | High | `documents` policies existed but the supplied migrations did not create the `documents` Storage bucket. | Document uploads fail on a clean database/storage project. | Added private bucket creation/configuration and aligned storage policies with document metadata visibility. |
| LTH-WF-008 | Medium | Teacher onboarding captured an experience range in `profiles.experience` but did not initialize the numeric `teacher_profiles.years_experience` field used by discovery. | New teachers could appear as having no experience and legacy teacher accounts may have no discovery profile. | Onboarding now maps the range; additive migration backfills missing teacher profile rows. |
| LTH-WF-009 | Medium | Teacher discovery and student dashboard did not filter teacher profiles by `profiles.is_verified`, despite discovery describing teachers as verified. | Unverified teachers could appear bookable. | Both surfaces now filter to verified profiles. |
| LTH-WF-010 | Medium | `booking-modal.tsx` generated only whole-hour slots, ignored minute offsets, checked bookings by exact start time, and ignored availability query errors. | Valid teacher availability could be displayed incorrectly and overlapping appointments could remain bookable. | Slot generation preserves minute offsets, requires a full hour, checks interval overlap, and reports query failures. |
| LTH-WF-011 | High | Booking logic uses the student's browser timezone while availability is stored in the teacher's timezone; `teacher_profiles.timezone` is not used for slot conversion. | Cross-timezone students can see the wrong weekday/time and create bookings at an unintended instant. | Not yet repaired; requires a defined teacher-local vs student-local display contract and timezone acceptance tests. |

| LTH-WF-012 | Critical | The document owner UPDATE policy allowed changing `file_path`/`file_url` while Storage visibility is derived from the metadata row. | An owner could potentially repoint a public metadata row at another user's private object. | Added a database trigger that makes owner/storage identity fields immutable while preserving metadata edits. Requires staging RLS/Storage verification. |
