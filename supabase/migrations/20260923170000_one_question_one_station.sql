-- One question = one station token.
-- `deployment_id` groups the ordered questions assigned to one PC while every
-- sequence item keeps a unique station token and a unique exam session.

ALTER TABLE public.exam_sequence_items
  ADD COLUMN IF NOT EXISTS deployment_id uuid;

-- Preserve each legacy token as one deployment group before splitting its
-- later questions onto their own station tokens.
WITH legacy_groups AS (
  SELECT station_token, gen_random_uuid() AS deployment_id
  FROM public.exam_sequence_items
  WHERE deployment_id IS NULL
  GROUP BY station_token
)
UPDATE public.exam_sequence_items AS item
SET deployment_id = legacy_groups.deployment_id
FROM legacy_groups
WHERE item.station_token = legacy_groups.station_token
  AND item.deployment_id IS NULL;

-- Keep the first/assigned legacy item on the URL the operator already knows.
-- Every other question receives a deterministic mapping row with a fresh token.
WITH ranked_items AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY station_token
           ORDER BY (session_id IS NOT NULL) DESC, sequence_order, created_at, id
         ) AS token_rank
  FROM public.exam_sequence_items
)
UPDATE public.exam_sequence_items AS item
SET station_token = 'LEGACY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
FROM ranked_items
WHERE item.id = ranked_items.id
  AND ranked_items.token_rank > 1;

-- Repair missing/dangling/repeated legacy session mappings and align every
-- retained session's token with its one sequence item.
DO $$
DECLARE
  item record;
  mapped_session_id uuid;
  seen_session_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR item IN
    SELECT id, case_id, station_token, session_id
    FROM public.exam_sequence_items
    ORDER BY deployment_id, sequence_order, created_at, id
  LOOP
    mapped_session_id := item.session_id;

    IF mapped_session_id IS NULL
       OR mapped_session_id = ANY(seen_session_ids)
       OR NOT EXISTS (
         SELECT 1 FROM public.exam_sessions WHERE id = mapped_session_id
       ) THEN
      INSERT INTO public.exam_sessions (case_id, station_token, status)
      VALUES (item.case_id, item.station_token, 'waiting')
      RETURNING id INTO mapped_session_id;

      UPDATE public.exam_sequence_items
      SET session_id = mapped_session_id
      WHERE id = item.id;
    ELSE
      UPDATE public.exam_sessions
      SET station_token = item.station_token
      WHERE id = mapped_session_id;
    END IF;

    seen_session_ids := array_append(seen_session_ids, mapped_session_id);
  END LOOP;
END;
$$;

-- If a production database lost the original UNIQUE constraint, retain the
-- sequence-linked session's token and move any unrelated duplicate aside.
WITH ranked_sessions AS (
  SELECT es.id,
         row_number() OVER (
           PARTITION BY es.station_token
           ORDER BY EXISTS (
             SELECT 1
             FROM public.exam_sequence_items esi
             WHERE esi.session_id = es.id
               AND esi.station_token = es.station_token
           ) DESC,
           es.created_at,
           es.id
         ) AS token_rank
  FROM public.exam_sessions es
)
UPDATE public.exam_sessions AS session
SET station_token = 'LEGACY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
FROM ranked_sessions
WHERE session.id = ranked_sessions.id
  AND ranked_sessions.token_rank > 1;

ALTER TABLE public.exam_sequence_items
  ALTER COLUMN deployment_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exam_sessions_station_token_unique_idx
  ON public.exam_sessions (station_token);

CREATE UNIQUE INDEX IF NOT EXISTS exam_sequence_items_station_token_unique_idx
  ON public.exam_sequence_items (station_token);

CREATE UNIQUE INDEX IF NOT EXISTS exam_sequence_items_session_id_unique_idx
  ON public.exam_sequence_items (session_id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exam_sequence_items_deployment_order_unique_idx
  ON public.exam_sequence_items (deployment_id, sequence_order);

DROP FUNCTION IF EXISTS public.get_session_by_token(text);

CREATE FUNCTION public.get_session_by_token(_token text)
RETURNS TABLE(
  id uuid,
  case_id uuid,
  status text,
  session_start_time timestamptz,
  sequence_order integer,
  sequence_total bigint,
  deployment_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT es.id,
         es.case_id,
         es.status,
         es.session_start_time,
         esi.sequence_order,
         CASE
           WHEN esi.deployment_id IS NULL THEN NULL
           ELSE (
             SELECT count(*)
             FROM public.exam_sequence_items grouped
             WHERE grouped.deployment_id = esi.deployment_id
           )
         END AS sequence_total,
         esi.deployment_id
  FROM public.exam_sessions es
  LEFT JOIN public.exam_sequence_items esi
    ON esi.session_id = es.id
   AND esi.station_token = es.station_token
  WHERE es.station_token = _token
  ORDER BY esi.sequence_order NULLS LAST, es.id
  LIMIT 1
$$;

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _current_item public.exam_sequence_items%ROWTYPE;
  _next_item public.exam_sequence_items%ROWTYPE;
  _existing public.exam_sessions%ROWTYPE;
  _new_session_id uuid;
  _total integer;
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

  SELECT count(*) INTO _total
  FROM public.exam_sequence_items
  WHERE deployment_id = _current_item.deployment_id;

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
      RETURN QUERY SELECT
        _existing.id, _existing.case_id, _existing.status,
        _existing.session_start_time, _next_item.sequence_order,
        (_next_item.sequence_order >= _total), _next_item.station_token,
        'reused'::text;
      RETURN;
    END IF;
  END IF;

  -- Compatibility repair for a legacy row whose session_id is null but whose
  -- token already has a session.
  SELECT * INTO _existing
  FROM public.exam_sessions
  WHERE station_token = _next_item.station_token;

  IF FOUND THEN
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

  INSERT INTO public.exam_sessions (case_id, station_token, status)
  VALUES (_next_item.case_id, _next_item.station_token, 'waiting')
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
