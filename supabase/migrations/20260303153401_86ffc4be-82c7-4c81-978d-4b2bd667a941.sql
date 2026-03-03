
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'candidate');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  dob DATE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create clinical_cases table
CREATE TABLE public.clinical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  exam_mode TEXT NOT NULL DEFAULT 'oral_board' CHECK (exam_mode IN ('oral_board', 'panel_exam')),
  initial_prompt TEXT NOT NULL DEFAULT '',
  checklist_rubric JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_limit_seconds INTEGER NOT NULL DEFAULT 360,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.clinical_cases ENABLE ROW LEVEL SECURITY;

-- Create case_assets table
CREATE TABLE public.case_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.clinical_cases(id) ON DELETE CASCADE NOT NULL,
  asset_url TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  asset_type TEXT NOT NULL DEFAULT 'image' CHECK (asset_type IN ('image', 'video')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.case_assets ENABLE ROW LEVEL SECURITY;

-- Create exam_sessions table
CREATE TABLE public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.clinical_cases(id) ON DELETE CASCADE NOT NULL,
  station_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'force_closed')),
  current_candidate_id UUID REFERENCES public.profiles(id),
  session_start_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- Create exam_results table
CREATE TABLE public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES public.profiles(id) NOT NULL,
  audio_file_url TEXT,
  transcript TEXT,
  ai_score_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: users can read/update own, admins can read all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles: only admins manage, users can read own
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Clinical cases: admins full access, candidates can read
CREATE POLICY "Admins manage cases" ON public.clinical_cases FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read cases" ON public.clinical_cases FOR SELECT TO authenticated USING (true);

-- Case assets: admins full access, authenticated can read
CREATE POLICY "Admins manage assets" ON public.case_assets FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read assets" ON public.case_assets FOR SELECT TO authenticated USING (true);

-- Exam sessions: admins full access, candidates can read/update own
CREATE POLICY "Admins manage sessions" ON public.exam_sessions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates can read own session" ON public.exam_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Candidates can update own session" ON public.exam_sessions FOR UPDATE TO authenticated USING (current_candidate_id = auth.uid());

-- Exam results: admins full access, candidates can read/insert own
CREATE POLICY "Admins manage results" ON public.exam_results FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates can read own results" ON public.exam_results FOR SELECT USING (candidate_id = auth.uid());
CREATE POLICY "Candidates can insert own results" ON public.exam_results FOR INSERT WITH CHECK (candidate_id = auth.uid());

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('case-assets', 'case-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-audio', 'exam-audio', false);

-- Storage RLS
CREATE POLICY "Admins can upload case assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public can read case assets" ON storage.objects FOR SELECT USING (bucket_id = 'case-assets');
CREATE POLICY "Admins can delete case assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'case-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can upload exam audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-audio');
CREATE POLICY "Admins can read exam audio" ON storage.objects FOR SELECT USING (bucket_id = 'exam-audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates can read own exam audio" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'exam-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Enable realtime for exam_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_sessions;
