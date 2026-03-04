
-- Add NIM column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nim text;

-- Add permissive SELECT policies for station display (anon access)
-- exam_sessions: allow reading by station_token for anyone
CREATE POLICY "Public read sessions by token"
ON public.exam_sessions FOR SELECT
TO anon, authenticated
USING (true);

-- clinical_cases: allow public read
CREATE POLICY "Public read cases"
ON public.clinical_cases FOR SELECT
TO anon, authenticated
USING (true);

-- case_assets: allow public read
CREATE POLICY "Public read assets"
ON public.case_assets FOR SELECT
TO anon, authenticated
USING (true);
