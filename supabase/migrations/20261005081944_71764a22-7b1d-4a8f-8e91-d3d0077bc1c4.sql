CREATE TABLE public.exam_access (
  user_id uuid PRIMARY KEY,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_access TO authenticated;
GRANT ALL ON public.exam_access TO service_role;
ALTER TABLE public.exam_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master admin manages exam access" ON public.exam_access FOR ALL TO authenticated
  USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "Users read own exam access" ON public.exam_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_exam_session(_session_id uuid, _candidate_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _session public.exam_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _candidate_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  IF NOT public.is_master_admin(_candidate_id) AND NOT EXISTS (
    SELECT 1 FROM public.exam_access ea WHERE ea.user_id = _candidate_id AND ea.allowed
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_allowed');
  END IF;

  SELECT * INTO _session FROM public.exam_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.exam_results er WHERE er.candidate_id = _candidate_id AND er.session_id = _session_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  IF _session.current_candidate_id = _candidate_id THEN
    RETURN jsonb_build_object('success', true, 'outcome', 'reused');
  END IF;
  IF _session.current_candidate_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_claimed');
  END IF;
  IF _session.status IN ('completed', 'force_closed') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_unavailable');
  END IF;

  UPDATE public.exam_sessions SET current_candidate_id = _candidate_id, status = 'active' WHERE id = _session_id;
  RETURN jsonb_build_object('success', true, 'outcome', 'claimed');
END;
$function$;

-- Block the direct-update claim path too
DROP POLICY IF EXISTS "Candidates can claim unclaimed session" ON public.exam_sessions;
CREATE POLICY "Candidates can claim unclaimed session" ON public.exam_sessions FOR UPDATE TO authenticated
  USING (current_candidate_id IS NULL)
  WITH CHECK (current_candidate_id = auth.uid() AND (public.is_master_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.exam_access ea WHERE ea.user_id = auth.uid() AND ea.allowed)));