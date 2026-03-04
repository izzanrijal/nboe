ALTER TABLE public.clinical_cases 
  ADD COLUMN reading_time_seconds integer NOT NULL DEFAULT 120,
  ADD COLUMN questions_text text NOT NULL DEFAULT '';