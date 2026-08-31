CREATE OR REPLACE FUNCTION public.has_billing_access(user_uuid uuid, check_env text default 'live')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (auth.uid() IS NOT NULL AND (user_uuid = auth.uid() OR public.has_role(auth.uid(), 'admin')))
    AND (
      EXISTS (
        SELECT 1 FROM public.billing_accounts ba
        WHERE ba.user_id = user_uuid
          AND (ba.access_mode = 'free' OR (ba.access_mode = 'trial' AND ba.trial_ends_at > now()))
      )
      OR EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = user_uuid
          AND s.environment = check_env
          AND (
            (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
            OR (s.status = 'canceled' AND s.current_period_end > now())
          )
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.has_billing_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_billing_access(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO service_role;