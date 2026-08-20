CREATE TABLE public.intake_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  submission_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_links TO authenticated;
GRANT ALL ON public.intake_links TO service_role;

ALTER TABLE public.intake_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own intake links" ON public.intake_links
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all intake links" ON public.intake_links
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX intake_links_user_id_idx ON public.intake_links(user_id);

CREATE TRIGGER update_intake_links_updated_at
  BEFORE UPDATE ON public.intake_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();