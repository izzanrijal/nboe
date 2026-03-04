-- ============================================================================
-- CONSOLIDATED SEED — Dual-Device Medical Board Exam Platform
-- 
-- Run this on a FRESH Supabase instance to recreate the entire schema.
-- Last synced: 2026-03-04
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'candidate');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  nim TEXT,
  dob DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.clinical_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  exam_mode TEXT NOT NULL DEFAULT 'oral_board',
  initial_prompt TEXT NOT NULL DEFAULT '',
  checklist_rubric JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_limit_seconds INTEGER NOT NULL DEFAULT 360,
  reading_time_seconds INTEGER NOT NULL DEFAULT 120,
  questions_text TEXT NOT NULL DEFAULT '',
  answer_key_text TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.case_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.clinical_cases(id) ON DELETE CASCADE,
  asset_url TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'image',
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'examination',
  answer_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.clinical_cases(id),
  station_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_candidate_id UUID REFERENCES public.profiles(id),
  session_start_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.exam_sessions(id),
  candidate_id UUID NOT NULL REFERENCES public.profiles(id),
  audio_file_url TEXT,
  transcript TEXT,
  ai_score_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_station_session(_case_id UUID, _new_token TEXT)
RETURNS TABLE(id UUID, case_id UUID, status TEXT, session_start_time TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.exam_sessions (case_id, station_token, status)
  VALUES (_case_id, _new_token, 'waiting')
  RETURNING exam_sessions.id, exam_sessions.case_id, exam_sessions.status::text, exam_sessions.session_start_time;
END;
$$;

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- clinical_cases
CREATE POLICY "Admins manage cases" ON public.clinical_cases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read cases" ON public.clinical_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read cases" ON public.clinical_cases FOR SELECT TO anon USING (true);

-- case_assets
CREATE POLICY "Admins manage assets" ON public.case_assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read assets" ON public.case_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read assets" ON public.case_assets FOR SELECT TO anon USING (true);

-- exam_sessions
CREATE POLICY "Admins manage sessions" ON public.exam_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates can read own session" ON public.exam_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read sessions by token" ON public.exam_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "Candidates can claim unclaimed session" ON public.exam_sessions FOR UPDATE TO authenticated USING (current_candidate_id IS NULL) WITH CHECK (current_candidate_id = auth.uid());
CREATE POLICY "Candidates can update own session" ON public.exam_sessions FOR UPDATE TO authenticated USING (current_candidate_id = auth.uid());

-- exam_results
CREATE POLICY "Admins manage results" ON public.exam_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates can insert own results" ON public.exam_results FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());
CREATE POLICY "Candidates can read own results" ON public.exam_results FOR SELECT TO authenticated USING (candidate_id = auth.uid());

-- ============================================================================
-- 6. STORAGE
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('case-assets', 'case-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-audio', 'exam-audio', false);

-- case-assets (public)
CREATE POLICY "Public read case assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'case-assets');
CREATE POLICY "Admins upload case assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete case assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'case-assets' AND public.has_role(auth.uid(), 'admin'));

-- exam-audio (private)
CREATE POLICY "Candidates upload exam audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-audio');
CREATE POLICY "Admins read exam audio" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'exam-audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete exam audio" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'exam-audio' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 7. REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_sessions;
