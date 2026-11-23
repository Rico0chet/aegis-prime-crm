DROP POLICY IF EXISTS "Authenticated read templates" ON public.needs_analysis_templates;
DROP POLICY IF EXISTS "Authenticated read questions" ON public.needs_analysis_questions;
CREATE POLICY "Producers with access read active templates" ON public.needs_analysis_templates
FOR SELECT TO authenticated
USING (is_active AND public.producer_has_access(auth.uid()));
CREATE POLICY "Producers with access read active questions" ON public.needs_analysis_questions
FOR SELECT TO authenticated
USING (
  public.producer_has_access(auth.uid())
  AND EXISTS (SELECT 1 FROM public.needs_analysis_templates t WHERE t.id = template_id AND t.is_active)
);