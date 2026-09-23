CREATE OR REPLACE FUNCTION public.advance_station_sequence(_station_token text, _completed_sequence_order integer)
 RETURNS TABLE(next_id uuid, next_case_id uuid, next_status text, next_session_start_time timestamp with time zone, next_sequence_order integer, next_is_last boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _next_item exam_sequence_items%ROWTYPE;
  _new_session_id uuid;
  _total integer;
  _existing exam_sessions%ROWTYPE;
BEGIN
  SELECT * INTO _next_item FROM exam_sequence_items
  WHERE station_token = _station_token AND sequence_order = _completed_sequence_order + 1;

  SELECT count(*) INTO _total FROM exam_sequence_items WHERE station_token = _station_token;

  IF _next_item IS NULL THEN
    RETURN;
  END IF;

  -- Idempotent: reuse the pending session for this item when it already exists
  IF _next_item.session_id IS NOT NULL THEN
    SELECT * INTO _existing FROM exam_sessions WHERE id = _next_item.session_id;
    IF _existing.id IS NOT NULL AND _existing.status IN ('waiting', 'active') THEN
      RETURN QUERY SELECT _existing.id, _existing.case_id, _existing.status,
        _existing.session_start_time, _next_item.sequence_order,
        (_next_item.sequence_order >= _total);
      RETURN;
    END IF;
  END IF;

  INSERT INTO exam_sessions (case_id, station_token, status)
  VALUES (_next_item.case_id, _station_token, 'waiting')
  RETURNING exam_sessions.id INTO _new_session_id;

  UPDATE exam_sequence_items SET session_id = _new_session_id WHERE id = _next_item.id;

  RETURN QUERY SELECT _new_session_id, _next_item.case_id, 'waiting'::text, NULL::timestamptz, _next_item.sequence_order, (_next_item.sequence_order >= _total);
END;
$function$;