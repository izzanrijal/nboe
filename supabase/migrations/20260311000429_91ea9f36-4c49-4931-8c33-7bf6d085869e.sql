
-- Table: exam_sequence_items
CREATE TABLE public.exam_sequence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_token text NOT NULL,
  case_id uuid NOT NULL REFERENCES public.clinical_cases(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL,
  session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_sequence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sequence items" ON public.exam_sequence_items
FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read sequence items" ON public.exam_sequence_items
FOR SELECT TO anon, authenticated USING (true);

-- Function: advance_station_sequence
CREATE OR REPLACE FUNCTION public.advance_station_sequence(
  _station_token text,
  _completed_sequence_order integer
)
RETURNS TABLE(next_id uuid, next_case_id uuid, next_status text, next_session_start_time timestamptz, next_sequence_order integer, next_is_last boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _next_item exam_sequence_items%ROWTYPE;
  _new_session_id uuid;
  _total integer;
BEGIN
  SELECT * INTO _next_item FROM exam_sequence_items
  WHERE station_token = _station_token AND sequence_order = _completed_sequence_order + 1;

  SELECT count(*) INTO _total FROM exam_sequence_items WHERE station_token = _station_token;

  IF _next_item IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO exam_sessions (case_id, station_token, status)
  VALUES (_next_item.case_id, _station_token, 'waiting')
  RETURNING exam_sessions.id INTO _new_session_id;

  UPDATE exam_sequence_items SET session_id = _new_session_id WHERE id = _next_item.id;

  RETURN QUERY SELECT _new_session_id, _next_item.case_id, 'waiting'::text, NULL::timestamptz, _next_item.sequence_order, (_next_item.sequence_order >= _total);
END;
$$;
