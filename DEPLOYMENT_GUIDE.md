# Leatha Deployment Guide (Preliminary)

## Current deployment target

The repository includes Cloudflare Wrangler configuration and the Cloudflare Vite plugin. No deployment was performed during this audit.

## Environment configuration

The archive's `.env` file is not suitable for redistribution. Store secrets in local untracked files or the hosting provider's encrypted secret manager.

Observed code expects these server-side values in different modules:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY` (server only)
- `LIVEKIT_API_SECRET` (server only)

Browser build values:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not set `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_LIVEKIT_API_SECRET`, or any other Vite-prefixed secret.

## Before staging deployment
1. Rotate the Supabase service-role credential found in the shared archive.
2. Confirm environment variables expected by the server client and auth middleware are configured consistently.
3. Fix LiveKit authorization in every token issuance path.
4. Reconcile local migration history with staging schema and migration ledger.
5. Review Storage policies and private cache behavior.
6. Align PWA icon paths with actual files.
7. Run TypeScript, lint, production build, integration, and E2E checks.
8. Configure Supabase Auth redirect URLs, allowed origins, and email templates.
9. Configure LiveKit allowed origins and server-side credentials.
10. Confirm backup and restore procedures.

## Production safety

- No production migrations or deployment without explicit approval.
- Back up the database before applying schema changes.
- Apply additive migrations in staging first.
- Verify rollback scripts before production changes.
- Do not include `.env` or `.dev.vars` in source archives or Git.
- Use a deployment checklist and smoke tests after release.

## Additional workflow-repair migrations (2026-11-20)

The working copy contains four additive migrations after the existing migration set:

1. `20261120113000_reconcile_feedback_workflow.sql`
2. `20261120120000_add_profile_relationship_foreign_keys.sql`
3. `20261120123000_notify_teacher_on_appointment.sql`
4. `20261120130000_repair_core_user_workflows.sql`

Before applying them to staging:

- Confirm the staging migration ledger and actual schema; do not assume it matches this archive.
- Back up staging and run the migrations in timestamp order.
- The profile relationship foreign keys are `NOT VALID` to avoid failing immediately on legacy orphan rows. Check for missing `profiles` records in appointments, teacher profiles, Arena participants, endorsements, suggestion upvotes, and lesson suggestions. Validate each constraint only after those checks are clean.
- Confirm the `documents` bucket is private and that owner/public/student visibility works for both metadata and Storage signed URLs.
- Test the custom-option RPC, teacher-school moderation, call update permissions, feedback submission/moderation, appointment creation/notification, and profile field protections.
- Refresh PostgREST schema cache if the new relationships are not immediately visible.
- The payment UI currently records payment details only. No automatic mobile-money provider charge or webhook is implemented; do not present payments as automatically processed.
- Cross-timezone appointment conversion remains outstanding and must be resolved before claiming international booking support.

These migrations have not been applied to staging or production in this audit session.
