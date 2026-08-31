CREATE TABLE public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_paddle_id ON public.subscriptions(paddle_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_mode text not null default 'trial',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  custom_price_cents integer,
  discount_percent integer not null default 0,
  referral_code text not null unique,
  referred_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_accounts_access_mode_check check (access_mode in ('trial','paid','free')),
  constraint billing_accounts_discount_check check (discount_percent >= 0 and discount_percent <= 100),
  constraint billing_accounts_custom_price_check check (custom_price_cents is null or custom_price_cents >= 0)
);

GRANT SELECT ON public.billing_accounts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.billing_accounts TO authenticated;
GRANT ALL ON public.billing_accounts TO service_role;
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing account" ON public.billing_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage billing accounts" ON public.billing_accounts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_accounts_updated_at BEFORE UPDATE ON public.billing_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.billing_settings (
  id boolean primary key default true,
  base_price_cents integer not null default 2000,
  referral_discount_percent integer not null default 10,
  trial_days integer not null default 14,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_settings_singleton check (id),
  constraint billing_settings_referral_check check (referral_discount_percent >= 0 and referral_discount_percent <= 100)
);

GRANT SELECT ON public.billing_settings TO authenticated;
GRANT INSERT, UPDATE ON public.billing_settings TO authenticated;
GRANT ALL ON public.billing_settings TO service_role;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in users can read billing settings" ON public.billing_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage billing settings" ON public.billing_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_settings_updated_at BEFORE UPDATE ON public.billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.billing_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.billing_accounts WHERE referral_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  days integer;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;

  SELECT trial_days INTO days FROM public.billing_settings WHERE id;
  INSERT INTO public.billing_accounts (user_id, trial_ends_at, referral_code, referred_by)
  VALUES (
    NEW.id,
    now() + make_interval(days => coalesce(days, 14)),
    public.generate_referral_code(),
    (SELECT user_id FROM public.billing_accounts
      WHERE referral_code = upper(NEW.raw_user_meta_data ->> 'referral_code'))
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO public.billing_accounts (user_id, referral_code, trial_ends_at)
SELECT u.id, public.generate_referral_code(), now() + interval '14 days'
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_billing_access(user_uuid uuid, check_env text default 'live')
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
        AND s.environment = check_env
        AND (
          (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
    );
$$;