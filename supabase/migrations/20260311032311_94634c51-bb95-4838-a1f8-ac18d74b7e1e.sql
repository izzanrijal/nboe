
-- Fix #2: Server-side timer start to prevent clock manipulation
CREATE OR REPLACE FUNCTION public.start_exam_timer(_session_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _now timestamptz := now();
BEGIN
  UPDATE exam_sessions
  SET session_start_time = _now
  WHERE id = _session_id AND current_candidate_id IS NOT NULL AND session_start_time IS NULL;

  IF NOT FOUND THEN
    -- Already started or invalid session
    SELECT session_start_time INTO _now FROM exam_sessions WHERE id = _session_id;
  END IF;

  RETURN _now;
END;
$$;
