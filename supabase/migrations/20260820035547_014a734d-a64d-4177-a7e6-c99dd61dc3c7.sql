DELETE FROM public.needs_analysis_answers
WHERE analysis_id IN (SELECT analysis_id FROM public.needs_analysis_invites WHERE token LIKE 'testtoken%');
DELETE FROM public.client_needs_analyses
WHERE id IN (SELECT analysis_id FROM public.needs_analysis_invites WHERE token LIKE 'testtoken%' AND analysis_id IS NOT NULL);
DELETE FROM public.needs_analysis_invites WHERE token LIKE 'testtoken%';