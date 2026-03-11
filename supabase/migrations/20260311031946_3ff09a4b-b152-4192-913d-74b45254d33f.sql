
-- Fix #6: Separate answer keys from public-readable clinical_cases
CREATE TABLE public.case_answer_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.clinical_cases(id) ON DELETE CASCADE UNIQUE,
  answer_key_text text NOT NULL DEFAULT '',
  checklist_rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_answer_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage answer keys" ON public.case_answer_keys
FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Copy existing data
INSERT INTO public.case_answer_keys (case_id, answer_key_text, checklist_rubric)
SELECT id, answer_key_text, checklist_rubric FROM public.clinical_cases;

-- Fix #1 + #5: Atomic session claim with duplicate prevention
CREATE OR REPLACE FUNCTION public.claim_exam_session(_session_id uuid, _candidate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _case_id uuid;
  _existing_count integer;
BEGIN
  -- Get session's case_id
  SELECT case_id INTO _case_id FROM exam_sessions WHERE id = _session_id;
  IF _case_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_not_found');
  END IF;

  -- Check if candidate already has results for this case
  SELECT count(*) INTO _existing_count
  FROM exam_results er
  JOIN exam_sessions es ON es.id = er.session_id
  WHERE er.candidate_id = _candidate_id AND es.case_id = _case_id;

  IF _existing_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  -- Check completed/force_closed sessions for this case
  SELECT count(*) INTO _existing_count
  FROM exam_sessions
  WHERE current_candidate_id = _candidate_id AND case_id = _case_id AND status IN ('completed', 'force_closed');

  IF _existing_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  -- Atomic claim: only succeeds if current_candidate_id IS NULL
  UPDATE exam_sessions
  SET current_candidate_id = _candidate_id, status = 'active'
  WHERE id = _session_id AND current_candidate_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_claimed');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Fix #7: Chat messages persistence
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read chat messages" ON public.chat_messages
FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated insert chat" ON public.chat_messages
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM exam_sessions WHERE id = session_id AND current_candidate_id = auth.uid())
);

-- Fix #5: Unique constraint to prevent double-submit per session
ALTER TABLE public.exam_results ADD CONSTRAINT exam_results_candidate_session_unique UNIQUE (candidate_id, session_id);
