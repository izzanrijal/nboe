ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS show_results_to_candidate_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exam_sessions.show_results_to_candidate_override IS
  'Deployment-level opt-in that allows candidates to view result details regardless of the case setting.';

-- Keep the deployment override when the next question's session is created.
-- The bool_or lookup also repairs a partially-created deployment by inheriting
-- a true value from any session already linked to the same deployment.
CREATE OR REPLACE FUNCTION public.advance_station_sequence(
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _current_item public.exam_sequence_items%ROWTYPE;
  _next_item public.exam_sequence_items%ROWTYPE;
  _existing public.exam_sessions%ROWTYPE;
  _new_session_id uuid;
  _total integer;
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

  SELECT count(*),
         COALESCE(bool_or(es.show_results_to_candidate_override), false)
  INTO _total, _deployment_override
  FROM public.exam_sequence_items grouped
  LEFT JOIN public.exam_sessions es ON es.id = grouped.session_id
  WHERE grouped.deployment_id = _current_item.deployment_id;

  -- This target-row lock serializes phone/station callers. The second caller
  -- observes the session_id written (or already present) by the first caller.
  SELECT * INTO _next_item
  FROM public.exam_sequence_items
  WHERE deployment_id = _current_item.deployment_id
    AND sequence_order = _current_item.sequence_order + 1
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
        (_next_item.sequence_order >= _total), _next_item.station_token,
        'reused'::text;
      RETURN;
    END IF;
  END IF;

  -- Compatibility repair for a row whose session_id is null but whose token
  -- already has a session.
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
      (_next_item.sequence_order >= _total), _next_item.station_token,
      'reused'::text;
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
  RETURNING exam_sessions.id INTO _new_session_id;

  UPDATE public.exam_sequence_items
  SET session_id = _new_session_id
  WHERE id = _next_item.id;

  RETURN QUERY SELECT
    _new_session_id, _next_item.case_id, 'waiting'::text,
    NULL::timestamptz, _next_item.sequence_order,
    (_next_item.sequence_order >= _total), _next_item.station_token,
    'advanced'::text;
END;
$$;
