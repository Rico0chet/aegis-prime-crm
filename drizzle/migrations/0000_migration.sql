DROP POLICY IF EXISTS "Signed in users can read billing settings" ON public.billing_settings;

CREATE OR REPLACE FUNCTION public.get_billing_pricing()
RETURNS TABLE (base_price_cents integer, referral_discount_percent integer, trial_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT base_price_cents, referral_discount_percent, trial_days
  FROM public.billing_settings
  WHERE id AND auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.get_billing_pricing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_pricing() TO authenticated, service_role;