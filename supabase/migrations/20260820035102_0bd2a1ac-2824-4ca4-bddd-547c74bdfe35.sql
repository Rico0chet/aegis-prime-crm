CREATE TABLE public.needs_analysis_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.needs_analysis_templates(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES public.client_needs_analyses(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.needs_analysis_invites TO authenticated;
GRANT ALL ON public.needs_analysis_invites TO service_role;

ALTER TABLE public.needs_analysis_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invites" ON public.needs_analysis_invites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all invites" ON public.needs_analysis_invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX needs_analysis_invites_client_idx ON public.needs_analysis_invites (client_id);

CREATE TRIGGER update_needs_analysis_invites_updated_at
  BEFORE UPDATE ON public.needs_analysis_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();