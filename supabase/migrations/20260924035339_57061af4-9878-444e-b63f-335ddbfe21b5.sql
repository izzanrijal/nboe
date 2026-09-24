CREATE OR REPLACE FUNCTION public.claim_exam_session(
  _session_id uuid,
  _candidate_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _session public.exam_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _candidate_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _session
  FROM public.exam_sessions
  WHERE id = _session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_not_found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.exam_results er
    WHERE er.candidate_id = _candidate_id
      AND er.session_id = _session_id
  ) THEN
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

  UPDATE public.exam_sessions
  SET current_candidate_id = _candidate_id,
      status = 'active'
  WHERE id = _session_id;

  RETURN jsonb_build_object('success', true, 'outcome', 'claimed');
END;
$function$;

DROP FUNCTION IF EXISTS public.advance_station_sequence(text, integer);

CREATE FUNCTION public.advance_station_sequence(
  _station_token text,
  _completed_sequence_order integer
)
RETURNS TABLE(
  next_id uuid,
  next_case_id uuid,
  next_status text,
  next_session_start_time timestamptz,
  next_sequence_order integer,
  next_is_last boolean,
  next_station_token text,
  outcome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_item public.exam_sequence_items%ROWTYPE;
  _next_item public.exam_sequence_items%ROWTYPE;
  _existing public.exam_sessions%ROWTYPE;
  _new_session_id uuid;
  _deployment_override boolean := false;
BEGIN
  SELECT * INTO _current_item
  FROM public.exam_sequence_items
  WHERE station_token = _station_token
  FOR UPDATE;

  IF NOT FOUND OR _current_item.sequence_order <> _completed_sequence_order THEN
    RETURN QUERY SELECT
      NULL::uuid, NULL::uuid, NULL::text, NULL::timestamptz,
      NULL::integer, false, NULL::text, 'invalid_order'::text;
    RETURN;
  END IF;

  SELECT COALESCE(bool_or(es.show_results_to_candidate_override), false)
  INTO _deployment_override
  FROM public.exam_sequence_items grouped
  LEFT JOIN public.exam_sessions es ON es.id = grouped.session_id
  WHERE grouped.deployment_id = _current_item.deployment_id;

  SELECT * INTO _next_item
  FROM public.exam_sequence_items
  WHERE deployment_id = _current_item.deployment_id
    AND sequence_order > _current_item.sequence_order
  ORDER BY sequence_order
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::uuid, NULL::uuid, NULL::text, NULL::timestamptz,
      NULL::integer, true, NULL::text, 'completed'::text;
    RETURN;
  END IF;

  IF _next_item.session_id IS NOT NULL THEN
    SELECT * INTO _existing
    FROM public.exam_sessions
    WHERE id = _next_item.session_id;

    IF FOUND THEN
      IF _deployment_override AND NOT _existing.show_results_to_candidate_override THEN
        UPDATE public.exam_sessions
        SET show_results_to_candidate_override = true
        WHERE id = _existing.id;
        _existing.show_results_to_candidate_override := true;
      END IF;

      RETURN QUERY SELECT
        _existing.id, _existing.case_id, _existing.status,
        _existing.session_start_time, _next_item.sequence_order,
        (_next_item.sequence_order = (
          SELECT max(last_item.sequence_order)
          FROM public.exam_sequence_items last_item
          WHERE last_item.deployment_id = _current_item.deployment_id
        )),
        _next_item.station_token, 'reused'::text;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO _existing
  FROM public.exam_sessions
  WHERE station_token = _next_item.station_token;

  IF FOUND THEN
    IF _deployment_override AND NOT _existing.show_results_to_candidate_override THEN
      UPDATE public.exam_sessions
      SET show_results_to_candidate_override = true
      WHERE id = _existing.id;
      _existing.show_results_to_candidate_override := true;
    END IF;

    UPDATE public.exam_sequence_items
    SET session_id = _existing.id
    WHERE id = _next_item.id;

    RETURN QUERY SELECT
      _existing.id, _existing.case_id, _existing.status,
      _existing.session_start_time, _next_item.sequence_order,
      (_next_item.sequence_order = (
        SELECT max(last_item.sequence_order)
        FROM public.exam_sequence_items last_item
        WHERE last_item.deployment_id = _current_item.deployment_id
      )),
      _next_item.station_token, 'reused'::text;
    RETURN;
  END IF;

  INSERT INTO public.exam_sessions (
    case_id,
    station_token,
    status,
    show_results_to_candidate_override
  )
  VALUES (
    _next_item.case_id,
    _next_item.station_token,
    'waiting',
    _deployment_override
  )
  RETURNING id INTO _new_session_id;

  UPDATE public.exam_sequence_items
  SET session_id = _new_session_id
  WHERE id = _next_item.id;

  RETURN QUERY SELECT
    _new_session_id, _next_item.case_id, 'waiting'::text,
    NULL::timestamptz, _next_item.sequence_order,
    (_next_item.sequence_order = (
      SELECT max(last_item.sequence_order)
      FROM public.exam_sequence_items last_item
      WHERE last_item.deployment_id = _current_item.deployment_id
    )),
    _next_item.station_token, 'advanced'::text;
END;
$function$;

DO $realtime$
DECLARE
  _table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH _table_name IN ARRAY ARRAY['exam_sessions', 'exam_results', 'exam_sequence_items']
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = _table_name
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          _table_name
        );
      END IF;
    END LOOP;
  END IF;
END;
$realtime$;