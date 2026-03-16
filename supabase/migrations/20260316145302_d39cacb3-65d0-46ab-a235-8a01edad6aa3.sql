
DROP POLICY "Service role can insert weekly reports" ON public.weekly_reports;

CREATE POLICY "Service role can insert weekly reports"
ON public.weekly_reports FOR INSERT
TO service_role
WITH CHECK (true);
