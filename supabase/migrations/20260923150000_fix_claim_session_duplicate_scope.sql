CREATE OR REPLACE FUNCTION public.claim_exam_session(_session_id uuid, _candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _case_id uuid;
  _existing_count integer;
BEGIN
  -- Validate that the requested session exists.
  SELECT case_id INTO _case_id FROM exam_sessions WHERE id = _session_id;
  IF _case_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_not_found');
  END IF;

  -- Prevent duplicate submission for this session without blocking a later
  -- session in a legitimate station sequence that happens to reuse a case.
  SELECT count(*) INTO _existing_count
  FROM exam_results er
  WHERE er.candidate_id = _candidate_id AND er.session_id = _session_id;

  IF _existing_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  -- Atomic claim: only succeeds if current_candidate_id IS NULL.
  UPDATE exam_sessions
  SET current_candidate_id = _candidate_id, status = 'active'
  WHERE id = _session_id AND current_candidate_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_claimed');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;
