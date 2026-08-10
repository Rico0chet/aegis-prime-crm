ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birthday_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_email_last_sent_year integer;

COMMENT ON COLUMN public.clients.birthday_email_enabled IS 'Whether the CRM may send an annual birthday email to this client.';
COMMENT ON COLUMN public.clients.birthday_email_last_sent_year IS 'Calendar year in which the annual birthday email was last sent.';