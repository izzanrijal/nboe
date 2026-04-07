
-- ============================================================================
-- SECURITY FIX: Restrict data exposure on exam_sessions, clinical_cases,
-- case_assets, and chat_messages
-- ============================================================================

-- 1. Create RPCs for StationDisplay (anon) to avoid open table access

CREATE OR REPLACE FUNCTION public.get_session_by_token(_token text)
RETURNS TABLE(id uuid, case_id uuid, status text, session_start_time timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT es.id, es.case_id, es.status, es.session_start_time
  FROM exam_sessions es
  WHERE es.station_token = _token
  ORDER BY es.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_case_display(_case_id uuid)
RETURNS TABLE(title text, initial_prompt text, time_limit_seconds integer, questions_text text, reading_time_seconds integer, show_results_to_candidate boolean, exam_mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT cc.title, cc.initial_prompt, cc.time_limit_seconds, cc.questions_text,
         cc.reading_time_seconds, cc.show_results_to_candidate, cc.exam_mode
  FROM clinical_cases cc WHERE cc.id = _case_id
$$;

CREATE OR REPLACE FUNCTION public.get_case_assets_for_display(_case_id uuid)
RETURNS TABLE(id uuid, asset_url text, asset_type text, trigger_keywords text[], category text, answer_text text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT ca.id, ca.asset_url, ca.asset_type, ca.trigger_keywords, ca.category, ca.answer_text
  FROM case_assets ca WHERE ca.case_id = _case_id
$$;

-- 2. Fix exam_sessions: remove unrestricted public/candidate reads

DROP POLICY IF EXISTS "Public read sessions by token" ON public.exam_sessions;
DROP POLICY IF EXISTS "Candidates can read own session" ON public.exam_sessions;

CREATE POLICY "Candidates can read own session"
ON public.exam_sessions FOR SELECT TO authenticated
USING (current_candidate_id = auth.uid());

-- 3. Fix clinical_cases: remove unrestricted public reads, scope to assigned cases

DROP POLICY IF EXISTS "Public read cases" ON public.clinical_cases;
DROP POLICY IF EXISTS "Authenticated can read cases" ON public.clinical_cases;

CREATE POLICY "Candidates can read assigned cases"
ON public.clinical_cases FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exam_sessions
    WHERE exam_sessions.case_id = clinical_cases.id
    AND exam_sessions.current_candidate_id = auth.uid()
  )
);

-- 4. Fix case_assets: remove unrestricted public reads

DROP POLICY IF EXISTS "Public read assets" ON public.case_assets;
DROP POLICY IF EXISTS "Authenticated can read assets" ON public.case_assets;

CREATE POLICY "Candidates can read assigned assets"
ON public.case_assets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exam_sessions
    WHERE exam_sessions.case_id = case_assets.case_id
    AND exam_sessions.current_candidate_id = auth.uid()
  )
);

-- 5. Fix chat_messages: add candidate SELECT for own session

CREATE POLICY "Candidates can read own session chat"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exam_sessions
    WHERE exam_sessions.id = chat_messages.session_id
    AND exam_sessions.current_candidate_id = auth.uid()
  )
);
