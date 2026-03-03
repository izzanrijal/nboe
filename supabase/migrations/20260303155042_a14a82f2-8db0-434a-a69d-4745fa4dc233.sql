
-- Allow candidates to claim an unclaimed session
CREATE POLICY "Candidates can claim unclaimed session"
ON public.exam_sessions FOR UPDATE TO authenticated
USING (current_candidate_id IS NULL)
WITH CHECK (current_candidate_id = auth.uid());
