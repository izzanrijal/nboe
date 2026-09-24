REVOKE ALL ON FUNCTION public.claim_exam_session(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_exam_session(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.advance_station_sequence(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_station_sequence(text, integer) TO anon, authenticated, service_role;