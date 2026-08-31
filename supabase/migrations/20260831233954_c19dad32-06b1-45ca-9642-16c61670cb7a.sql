-- 1. Access check usable by app code (any environment) and by trusted server code.

CREATE OR REPLACE FUNCTION public.producer_has_access(user_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.billing_accounts ba
      WHERE ba.user_id = user_uuid
        AND (ba.access_mode = 'free' OR (ba.access_mode = 'trial' AND ba.trial_ends_at > now()))
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = user_uuid
        AND (
          (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.producer_has_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.producer_has_access(uuid) TO authenticated, service_role;

-- 2. Write gating on core CRM tables: reads and deletes stay open, writes need access.

DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Users manage own clients" ON public.clients FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own policies" ON public.policies;
CREATE POLICY "Users manage own policies" ON public.policies FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own activities" ON public.activities;
CREATE POLICY "Users manage own activities" ON public.activities FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own analyses" ON public.client_needs_analyses;
CREATE POLICY "Users manage own analyses" ON public.client_needs_analyses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own answers" ON public.needs_analysis_answers;
CREATE POLICY "Users manage own answers" ON public.needs_analysis_answers FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own intake links" ON public.intake_links;
CREATE POLICY "Users manage own intake links" ON public.intake_links FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own invites" ON public.needs_analysis_invites;
CREATE POLICY "Users manage own invites" ON public.needs_analysis_invites FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

DROP POLICY IF EXISTS "Users manage own appointments" ON public.appointments;
CREATE POLICY "Users manage own appointments" ON public.appointments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.producer_has_access(auth.uid()));

-- 3. Billing history.

CREATE TABLE public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  paddle_transaction_id text not null,
  paddle_subscription_id text,
  status text not null,
  amount_cents integer,
  currency_code text,
  occurred_at timestamptz not null default now(),
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paddle_transaction_id, environment)
);

CREATE INDEX idx_billing_transactions_user ON public.billing_transactions(user_id, occurred_at DESC);

GRANT SELECT ON public.billing_transactions TO authenticated;
GRANT ALL ON public.billing_transactions TO service_role;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own billing history" ON public.billing_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_transactions_updated_at BEFORE UPDATE ON public.billing_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Store the private per-producer discount so it is reused, not recreated.

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS paddle_discount_id text,
  ADD COLUMN IF NOT EXISTS paddle_discount_env text,
  ADD COLUMN IF NOT EXISTS paddle_discount_key text;

-- 5. Tighten grants: only admins write these, enforced by RLS; drop unneeded grants.

REVOKE INSERT, DELETE ON public.billing_accounts FROM authenticated;
REVOKE INSERT ON public.billing_settings FROM authenticated;