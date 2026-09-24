-- Reset a completed physical PC by cloning its full ordered deployment.
-- The completed deployment and its result-bearing sessions remain immutable;
-- the station receives the first waiting session of a brand-new deployment.

CREATE TABLE public.station_deployment_resets (
  completed_deployment_id uuid PRIMARY KEY,
  next_deployment_id uuid NOT NULL UNIQUE,
  next_session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  next_station_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.station_deployment_resets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reset_completed_station_sequence(
  _station_token text,
  _new_tokens text[]
)
RETURNS TABLE(
  id uuid,
  case_id uuid,
  status text,
  session_start_time timestamptz,
  station_token text,
  deployment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_item public.exam_sequence_items%ROWTYPE;
  _source record;
  _existing_reset public.station_deployment_resets%ROWTYPE;
  _new_deployment_id uuid := gen_random_uuid();
  _new_session_id uuid;
  _first_session_id uuid;
  _first_case_id uuid;
  _first_token text;
  _item_count integer;
  _token_count integer;
  _token_index integer := 0;
BEGIN
  -- This lock serializes a countdown/click race and requests from another tab.
  SELECT * INTO _current_item
  FROM public.exam_sequence_items
  WHERE exam_sequence_items.station_token = _station_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'station sequence not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.exam_sequence_items later
    WHERE later.deployment_id = _current_item.deployment_id
      AND later.sequence_order > _current_item.sequence_order
  ) THEN
    RAISE EXCEPTION 'station sequence is not complete';
  END IF;

  -- Return the same reset on retry instead of creating another deployment.
  SELECT * INTO _existing_reset
  FROM public.station_deployment_resets reset_mapping
  WHERE reset_mapping.completed_deployment_id = _current_item.deployment_id;

  IF FOUND THEN
    RETURN QUERY
    SELECT session.id,
           session.case_id,
           session.status,
           session.session_start_time,
           session.station_token,
           _existing_reset.next_deployment_id
    FROM public.exam_sessions session
    WHERE session.id = _existing_reset.next_session_id;
    RETURN;
  END IF;

  SELECT count(*) INTO _item_count
  FROM public.exam_sequence_items item
  WHERE item.deployment_id = _current_item.deployment_id;

  _token_count := COALESCE(array_length(_new_tokens, 1), 0);
  IF _token_count <> _item_count
     OR EXISTS (
       SELECT 1
       FROM unnest(_new_tokens) AS supplied(token)
       WHERE supplied.token IS NULL OR btrim(supplied.token) = ''
     )
     OR (
       SELECT count(DISTINCT supplied.token)
       FROM unnest(_new_tokens) AS supplied(token)
     ) <> _item_count THEN
    RAISE EXCEPTION 'one distinct station token is required for every sequence item';
  END IF;

  -- A reset is allowed only after every question session is terminal.
  IF EXISTS (
    SELECT 1
    FROM public.exam_sequence_items item
    LEFT JOIN public.exam_sessions session ON session.id = item.session_id
    WHERE item.deployment_id = _current_item.deployment_id
      AND (session.id IS NULL OR session.status NOT IN ('completed', 'force_closed'))
  ) THEN
    RAISE EXCEPTION 'all station sessions must be completed before reset';
  END IF;

  FOR _source IN
    SELECT item.case_id,
           item.sequence_order,
           session.show_results_to_candidate_override
    FROM public.exam_sequence_items item
    JOIN public.exam_sessions session ON session.id = item.session_id
    WHERE item.deployment_id = _current_item.deployment_id
    ORDER BY item.sequence_order, item.id
  LOOP
    _token_index := _token_index + 1;

    INSERT INTO public.exam_sessions (
      case_id,
      station_token,
      status,
      show_results_to_candidate_override
    )
    VALUES (
      _source.case_id,
      _new_tokens[_token_index],
      'waiting',
      _source.show_results_to_candidate_override
    )
    RETURNING exam_sessions.id INTO _new_session_id;

    INSERT INTO public.exam_sequence_items (
      deployment_id,
      station_token,
      case_id,
      sequence_order,
      session_id
    )
    VALUES (
      _new_deployment_id,
      _new_tokens[_token_index],
      _source.case_id,
      _source.sequence_order,
      _new_session_id
    );

    IF _first_session_id IS NULL THEN
      _first_session_id := _new_session_id;
      _first_case_id := _source.case_id;
      _first_token := _new_tokens[_token_index];
    END IF;
  END LOOP;

  INSERT INTO public.station_deployment_resets (
    completed_deployment_id,
    next_deployment_id,
    next_session_id,
    next_station_token
  )
  VALUES (
    _current_item.deployment_id,
    _new_deployment_id,
    _first_session_id,
    _first_token
  );

  RETURN QUERY SELECT
    _first_session_id,
    _first_case_id,
    'waiting'::text,
    NULL::timestamptz,
    _first_token,
    _new_deployment_id;
END;
$function$;
