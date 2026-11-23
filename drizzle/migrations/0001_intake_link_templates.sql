ALTER TABLE public.intake_links ADD COLUMN template_id uuid REFERENCES public.needs_analysis_templates(id) ON DELETE SET NULL;
INSERT INTO public.needs_analysis_templates (id, name, description, is_active, sort_order)
VALUES ('33333333-3333-4333-8333-333333333333', 'Generic', 'Comprehensive life insurance client needs analysis', true, 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.needs_analysis_questions (template_id, prompt, help_text, input_type, options, is_required, sort_order)
SELECT '33333333-3333-4333-8333-333333333333', prompt, help_text, input_type, options, false, sort_order
FROM public.needs_analysis_questions
WHERE template_id = 'b73fabde-2eb0-49f0-bae9-f8b392556f67'
AND NOT EXISTS (SELECT 1 FROM public.needs_analysis_questions WHERE template_id = '33333333-3333-4333-8333-333333333333');