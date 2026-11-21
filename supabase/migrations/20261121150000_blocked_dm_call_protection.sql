-- Prevent direct messages and calls whenever either participant has blocked
-- the other. The function intentionally returns only a boolean and checks
-- both directions without exposing another user's block records.

CREATE OR REPLACE FUNCTION public.can_interact_with_user(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND _other_user_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _other_user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.blocks b
      WHERE
        (b.blocker_id = auth.uid() AND b.blocked_id = _other_user_id)
        OR
        (b.blocker_id = _other_user_id AND b.blocked_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.can_interact_with_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_interact_with_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_interact_with_user(uuid) TO authenticated;

-- A client-side disabled composer is not an authorization boundary.
-- Enforce the same mutual-block rule for direct Supabase API inserts.
DROP POLICY IF EXISTS "Users send DMs" ON public.direct_messages;

CREATE POLICY "Users send DMs"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.can_interact_with_user(recipient_id)
);
