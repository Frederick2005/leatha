# Leatha Architecture (Observed)

## Technology stack
- React 19 and TypeScript
- Vite 7
- TanStack Router and TanStack Start
- Supabase Auth, PostgreSQL, RLS, Storage, and Edge Functions
- `@supabase/supabase-js`
- Ant Design / Ant Design Pro components, Radix UI, Tailwind CSS 4
- LiveKit client and server SDKs
- Cloudflare Vite plugin and Wrangler
- Vite PWA plugin

## Frontend organization
- `src/routes/`: file-based route modules, including admin, auth, dashboard, lessons, messages, schools, appointments, teacher pages, and Arena.
- `src/components/`: application shell, dashboards, lesson/media components, booking modal, LiveKit call component, and UI primitives.
- `src/providers/`: authentication and theme context.
- `src/integrations/supabase/`: browser client, server client, auth middleware, and generated database types.
- `src/lib/`: analytics, Arena utilities, LiveKit helpers, ratings, and theme utilities.

## Backend and data access
- Most observed UI data access uses the browser Supabase client and relies on RLS.
- A service-role Supabase client exists in `client.server.ts`; repository search found no call sites importing it.
- A bearer-token auth middleware exists in `auth-middleware.ts`; repository search found no call sites using it.
- Supabase Edge Functions exist for admin user deletion, LiveKit token generation, and rating-event processing.
- A TanStack API route and a TanStack server function also issue LiveKit tokens.

## Database
- 24 SQL migration files.
- 60 unique table names found across migrations; each has a corresponding RLS enablement statement in the migration history.
- 190 policy declarations, 23 function declarations, and 34 trigger declarations found by static pattern scan.
- Core domains include profiles/roles, lessons/forks, social interactions, messaging, schools/teacher relationships, appointments/payments, Arena, ratings, feedback, invitations, analytics, and moderation.

## Authentication and authorization
- Browser Supabase client persists the session in local storage and refreshes tokens.
- `AuthProvider` loads profiles and `user_roles` into client context.
- `RequireAuth` and account-type route guards are frontend navigation controls; they do not replace server-side authorization.
- `requireSupabaseAuth` provides bearer-token validation for server functions but is not visibly integrated into application operations.
- RLS is therefore a major security boundary and requires policy-level testing.

## Deployment and PWA
- Cloudflare Wrangler configuration uses the TanStack Start server entry and `nodejs_compat`.
- Vite PWA plugin configures a manifest and Workbox runtime caching.
- A separate `public/sw.js` custom worker is present; no explicit registration call was found in `src` during static search. Verify the effective generated/served service worker before changing it.

## Known architecture debt
- Multiple LiveKit token issuance paths.
- Privileged operations are frequently initiated directly from the browser.
- No automated test scripts in `package.json`.
- README is empty.
- Book commerce and AI assistant functionality were not found in the source inventory.
