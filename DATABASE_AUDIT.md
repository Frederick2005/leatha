# Leatha Database Audit

## Inventory

Static scan of 24 migration files found:
- 60 unique created table names.
- 60 corresponding `ENABLE ROW LEVEL SECURITY` statements.
- 190 policy declarations.
- 23 function declarations.
- 34 trigger declarations.

This is a migration-history inventory, not a live schema snapshot. The live database may differ if migrations were applied selectively or manually edited.

## Core domains observed

`profiles`, `user_roles`, `lessons`, `lesson_contributors`, `lesson_likes`, `lesson_views`, `comments`, `follows`, `blocks`, `bookmarks`, `direct_messages`, `chat_messages`, `schools`, `teacher_schools`, `teacher_profiles`, `teacher_verifications`, `appointments`, `payment_intents`, `calls`, `call_participants`, `arena_*`, `reports`, `admin_logs`, `feedback`, `support_tickets`, `notifications`, `analytics_events`, `documents`, `class_groups`, `class_memberships`, and `class_assignments`.

## Confirmed policy concerns

1. `user_roles`: broad admin `FOR ALL` policy combined with a trigger that does not fire on UPDATE. Protect role updates and remove direct client writes.
2. `profiles`: own-row UPDATE policy does not restrict sensitive columns including account type, verification, points, XP, level, and streak values.
3. `calls`: unrestricted authenticated UPDATE (`USING true`, `WITH CHECK true`).
4. `custom_options`: unrestricted authenticated UPDATE (`USING true`, `WITH CHECK true`).
5. `teacher_schools`: teacher and school admin share broad UPDATE authority; field-specific transition control is absent.
6. `teacher_verifications`: moderator/admin update policy has no explicit transition or reviewer-field guard.
7. `call_participants`: participant read policy is broad across authenticated users; review whether participant metadata should be private to call members/hosts.

## Positive controls

- RLS enablement statements exist for every uniquely discovered table.
- Appointment update trigger enforces immutable booking/price fields and legal state transitions.
- Payment intent policy migration restricts payer updates to cancellation of their own pending intent.
- Role checks use a separate `user_roles` table and security-definer helper functions.

## Required next steps

- Compare this migration history with the actual Supabase schema and migration ledger.
- Inspect effective `pg_policies`, table grants, function owners, `SECURITY DEFINER` settings, and Storage policies in staging.
- Add SQL tests for positive and negative authorization cases across student, teacher, school admin, moderator, admin, and super-admin identities.
- Add reversible migrations for the confirmed policy defects only after the current live schema is reconciled.


## 2026-11-20 — Feedback schema reconciliation

### Confirmed defect: duplicate `feedback` table definitions

Two earlier migrations create `public.feedback` with incompatible definitions using `CREATE TABLE IF NOT EXISTS`. The first migration (`20260501000000_add_account_type_and_feedback.sql`) creates `message` and `contact`; the later migration (`20260501131101_...sql`) attempts to create `body`, `category`, and `status`, but `IF NOT EXISTS` does not add those columns to an existing table. The later feedback enhancement migration adds `rating`, `priority`, `admin_notes`, `response`, `responded_at`, and `responded_by`, but does not reconcile the missing `category` or `status` columns.

The current feedback form inserts `message`, `category`, and `rating`. `category` is therefore a confirmed insert failure on a database built from the supplied migrations. The admin feedback panel expects `body` and `status`; `body` does not exist in the effective schema and `status` is also absent. This prevents reliable feedback submission and administration.

### Repair prepared

- Added an additive migration to add `category` and `status`, with safe defaults and an allowed-status check.
- Kept the existing `message` and `contact` columns to preserve data and compatibility.
- Updated the feedback form to store the contact value in the dedicated `contact` column rather than concatenating it into the message.
- Updated the admin panel to display `message` and to report update failures instead of showing success unconditionally.
- Reconciled the generated TypeScript `feedback` table type with the effective schema.

The migration has not been applied to any live database. It is additive and has not been executed against production.


## Additional workflow/schema findings — 2026-11-20

### Appointment/profile relationships

Several application queries request embedded `profiles` records using foreign-key names that do not exist in the migrations. The relevant tables reference `auth.users`, or have no user foreign key at all, rather than declaring the explicit relationship to `public.profiles` that PostgREST needs for these joins. This affects appointment list/detail/earnings queries, teacher profile selection in the alternate booking form, Arena battle participant profiles, lesson suggestion authors/claimers, suggestion upvoters, and teacher endorsements.

An additive migration now declares supplemental `public.profiles` foreign keys with `NOT VALID`, preserving the original `auth.users` constraints and avoiding a blocking scan of legacy rows. These constraints enforce referential integrity for new writes. Existing rows must be checked and the constraints validated after the target database is available. The corresponding relationship names are reflected in generated TypeScript definitions and application selects.

### Notification creation

The booking client attempted to insert notification fields named `message` and `actor_id`, while `public.notifications` defines `body` and `related_id`. More importantly, the notifications table intentionally grants authenticated users SELECT/UPDATE but not INSERT, so direct client insertion is not permitted. The previous client ignored the notification insert result.

A database trigger now creates the teacher notification after an appointment is inserted. This uses the actual notification columns and runs in the same transaction as the booking. The browser no longer attempts an unauthorized notification insert.

### Currency consistency

The teacher profile stores `hourly_rate_cents` and `currency` (default USD). The discovery and booking modal treated the same value as UGX, while the alternative booking form used the teacher's configured currency. The discovery page and primary booking flow now display and persist the teacher's configured currency. The student dashboard no longer requests the nonexistent `teacher_profiles.hourly_rate` column.

### Payment messaging

The payment dialog recorded a `payment_intents` row but did not call a mobile-money provider. Its previous copy incorrectly claimed that a payment prompt would be sent. The interface now states that it records payment details and that payment must be completed manually until a provider integration exists.

## Follow-up workflow/schema reconciliation — 2026-11-20

### Corrected inventory

The earlier list of potentially missing application tables was a false positive from an incomplete pass. The supplied migration history does create `schools`, `teacher_schools`, `analytics_events`, `custom_options`, `support_tickets`, `invite_links`, `invite_uses`, and `creator_rating_state`. A source-level cross-check now finds 60 distinct migrated tables and 47 `.from(...)` references; the only non-table `.from(...)` names are Storage buckets, which are checked separately.

### Confirmed Storage defect: documents bucket

`src/routes/documents.tsx` uploads, signs, and removes objects in the `documents` bucket. The migration history had Storage policies for `documents` but no `INSERT INTO storage.buckets` statement for that bucket. This causes uploads to fail on a database where the bucket was not created manually. The new core workflow migration creates it as a private bucket, sets a 20 MB limit and accepted document MIME types, and aligns Storage SELECT permissions with the `documents.visibility` field and active teacher-student relationship.

### Confirmed custom-option authorization defect

`custom_options` allowed every authenticated user to update every row. The UI's stated behavior was to increment an option's usage count when selected, but it did not do so. The new migration removes general UPDATE permission and adds `record_custom_option(text,text)`, which atomically inserts or increments the requested option after validating the category/value and derives `created_by` from `auth.uid()`.

### Confirmed teacher-school approval defect

The original teacher membership INSERT policy checked only `teacher_id`, allowing a teacher to submit a row already marked approved. The UPDATE policy also allowed the teacher to update their own status. The new migration requires self-submitted rows to start pending, limits approval/rejection updates to the school administrator or platform moderators/admins, and makes membership identity columns immutable.

### Confirmed account and aggregate integrity gaps

- The later `handle_new_user()` definition declared `v_account_type` as `text` while `profiles.account_type` was created as `public.account_type`; the new trigger uses the enum type and an explicit allowlist for self-signup.
- The signup form supplied grade and subject metadata; the corrected trigger now persists those fields to the existing profile columns.
- Teacher onboarding previously saved subjects only to `profiles`, while teacher discovery reads `teacher_profiles`; onboarding now upserts the teacher discovery row.
- The profile UPDATE policy did not provide an administrator update path even though the admin UI updates verification and reward fields. The new migration adds an explicit admin/moderator policy and guards privileged counters from ordinary self-edits.
- Teacher profile RLS allowed a teacher to update reputation and earnings aggregates. The new migration protects those derived columns while leaving ordinary profile fields editable.

All changes above are local migration/source changes only. They have not been executed against a live database.


### Additional workflow review — documents, onboarding, availability

- The original migration history defined document-storage policies but did not create the `documents` Storage bucket. The additional core workflow migration now creates/configures it as private and aligns object access with the `documents` metadata visibility.
- Document upload now validates extension/size before entering the busy state, removes an uploaded object if metadata insertion fails, and stores the private object key rather than a public URL. Document load/delete failures are surfaced.
- Custom option persistence now uses the `record_custom_option` RPC, matching the restricted database policy instead of attempting direct usage-count updates.
- Teacher onboarding now creates the separate `teacher_profiles` record required by teacher discovery and maps the selected experience range into the numeric `years_experience` field while retaining the original range in the profile.
- Teacher discovery and the student dashboard now filter to verified teacher profiles, matching the public page's stated promise.
- Booking availability now preserves minute offsets, only offers full one-hour slots that fit the availability window, checks overlapping appointments, and reports availability query errors.

### Remaining booking limitation

`teacher_profiles.timezone` is stored and editable, but the booking modal still derives weekday, selected slot instants, and display times from the student's browser timezone. Cross-timezone booking can therefore show or save the wrong local time. This needs a dedicated timezone conversion design and acceptance tests before international bookings can be considered reliable.

### Privileged role row transitions

The original protection trigger did not cover UPDATE. The new `20261120131000_protect_role_mutations.sql` extends it to INSERT, UPDATE, and DELETE. Ordinary authenticated admins cannot alter admin/super-admin role rows, and the final super-admin cannot be demoted or deleted through the application. First super-admin designation remains an explicit trusted database-owner operation; the migration does not infer an owner from the archive or signup order.


### Document object identity protection

The new document visibility policy relies on the metadata row's `file_path` to decide who can obtain a signed URL. The legacy document owner-update policy was broad enough to let an owner change that path and potentially point a public metadata row at another user's object. The core workflow migration now uses a trigger to keep owner and storage identity fields immutable while still allowing title, subject, and visibility edits.
- The same migration aligns `is_mod_or_admin()` and `user_roles` RLS policies with the distinct `super_admin` role, so the protected controller can actually view and manage role records without requiring a second ordinary admin role.
