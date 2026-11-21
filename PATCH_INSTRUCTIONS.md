# Applying the Leatha workflow-repair patch

This patch contains only files that differ from the supplied `leatha-test` archive, plus this instruction file. It is designed to be extracted over the existing project folder.

## Before replacing files

1. Stop the Vite development server and close editors that may be writing project files.
2. Make a complete backup copy of your current project folder. For example, copy `leatha-test` to `leatha-test-backup-2026-11-20`.
3. Keep your existing `.env` file safe. The patch intentionally does **not** contain `.env` or production credentials.
4. If you have made your own edits since the ZIP you supplied, compare those files before overwriting them.

## Replace the source files

1. Download `leatha-update-patch.zip`.
2. Open your existing `leatha-test` project folder.
3. Extract the patch ZIP directly into that folder (the ZIP paths begin with `src/`, `supabase/`, and so on).
4. When Windows asks whether to replace files, choose **Replace the files in the destination** for the files included in the patch.
4. Do not delete your existing project folder and do not replace `.env`.

The patch includes the new SQL migrations, application changes, contract-check script, and updated engineering documentation. It does not include `node_modules`, build output, Git history, or secrets.

## Database migrations — do not skip this step

The source changes depend on the following new migrations being applied to the correct Supabase project, in timestamp order:

1. `20261120113000_reconcile_feedback_workflow.sql`
2. `20261120120000_add_profile_relationship_foreign_keys.sql`
3. `20261120123000_notify_teacher_on_appointment.sql`
4. `20261120130000_repair_core_user_workflows.sql`
5. `20261120131000_protect_role_mutations.sql`
6. `20261121150000_blocked_dm_call_protection.sql`
7. `20261121160000_secure_support_ticket_submissions.sql`

Before applying them:

- Back up the database.
- Confirm the existing Supabase migration history matches the repository.
- Review the SQL, especially the `documents` bucket being made private and the changed RLS policies.
- Apply to a disposable/staging Supabase project first.
- Test student, teacher, school-admin, moderator and admin actions before considering production.
- The migration does not automatically select the permanent absolute-controller account. That owner must be identified and verified, then designated through trusted database administration; do not use public signup metadata or an ordinary admin UI for this.

If you use Supabase CLI, link the intended project, inspect `supabase migration list`, run a dry-run if supported by your CLI version, and then apply only after confirming the target project and migration order. Do not run migrations against production merely to make the source patch appear complete.

## Verify locally

From the project root:

```bash
npm ci
npm run test:contracts
npm run lint
npx tsc --noEmit
npm run build
```

`npm run test:contracts` is a dependency-free static contract check. The other commands require dependencies and a working npm registry.

## Required server environment

Keep these values server-side:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or the corresponding `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` public client configuration)
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Never put `LIVEKIT_API_SECRET` or the Supabase service-role key in a `VITE_` variable. Supabase Edge Functions also need their normal Supabase URL and anon/publishable key environment values.

## Important limitations

- Local TypeScript, ESLint, production build, and 25 static workflow contract checks have passed.
- ESLint reports zero errors and 10 React Refresh warnings. The production build reports large-chunk warnings.
- These checks do not establish runtime correctness for database migrations, RLS, Storage, LiveKit, or browser workflows.
- The seven listed migrations have not been confirmed as applied to staging or production. Inspect migration history and test on staging before production application.
- The permanent absolute-controller account still requires explicit trusted-owner designation.
- Assignment/grading, Arena server-side scoring, commerce, and payment-provider workflows need further work.
- Complete browser-based end-to-end testing remains outstanding.
