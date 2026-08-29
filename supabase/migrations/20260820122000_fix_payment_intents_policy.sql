-- 1) The provider check constraint only allowed ('mtn','airtel','paxtel'), but
--    the frontend (booking-modal.tsx) has always offered "pesapal" as a third
--    option, and appointments.$id.tsx's PayDialog is being aligned to match.
--    Every "Pesapal" payment attempt has been failing this constraint.
ALTER TABLE public.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_provider_check;
ALTER TABLE public.payment_intents
  ADD CONSTRAINT payment_intents_provider_check CHECK (provider IN ('mtn', 'airtel', 'pesapal'));

-- 2) "pi_update_party" currently lets EITHER the payer or payee update a
--    payment_intents row with no restriction on which columns change. That
--    means the paying student can call
--    `.from('payment_intents').update({ status: 'succeeded' }).eq('id', ...)`
--    directly and mark their own unpaid booking as paid - nothing was
--    actually verifying the mobile money charge went through.
--
--    Real status transitions to 'succeeded'/'failed' must come from a
--    trusted source (a payment-provider webhook handled by an edge function
--    using the service-role key). The client may only ever create a pending
--    intent (already covered by pi_insert_payer) or cancel their own
--    still-pending one before it's actioned.
DROP POLICY IF EXISTS "pi_update_party" ON public.payment_intents;
CREATE POLICY "pi_cancel_own_pending" ON public.payment_intents
  FOR UPDATE TO authenticated
  USING (auth.uid() = payer_id AND status = 'pending')
  WITH CHECK (auth.uid() = payer_id AND status = 'cancelled');
-- service_role (the webhook/edge function) still has unrestricted UPDATE via
-- the existing "GRANT ALL ... TO service_role", which bypasses RLS entirely.
