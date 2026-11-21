-- Secure support-ticket submissions while preserving guest access.
-- Guests must submit unlinked tickets; authenticated users may only
-- associate a ticket with their own account.

REVOKE INSERT ON TABLE public.support_tickets FROM PUBLIC, anon, authenticated;

GRANT INSERT (user_id, email, subject, message)
ON TABLE public.support_tickets
TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can submit ticket" ON public.support_tickets;
DROP POLICY IF EXISTS "Guests submit unlinked tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users submit own tickets" ON public.support_tickets;

CREATE POLICY "Guests submit unlinked tickets"
ON public.support_tickets
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Users submit own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);
