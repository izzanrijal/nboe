CREATE OR REPLACE FUNCTION public.regenerate_station_session(
  _case_id uuid,
  _new_token text
)
RETURNS TABLE(id uuid, case_id uuid, status text, session_start_time timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.exam_sessions (case_id, station_token, status)
  VALUES (_case_id, _new_token, 'waiting')
  RETURNING exam_sessions.id, exam_sessions.case_id, exam_sessions.status::text, exam_sessions.session_start_time;
END;
$$;