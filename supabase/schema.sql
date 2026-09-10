-- LUC Exam - Supabase Database Schema
-- Run this in your Supabase SQL Editor to initialize the database

-- 0. Cleanup (Optional: Drop existing to avoid "already exists" errors during re-runs)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.is_admin();

DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.answers CASCADE;
DROP TABLE IF EXISTS public.attempts CASCADE;
DROP TABLE IF EXISTS public.exam_roster CASCADE;
DROP TABLE IF EXISTS public.correct_answers CASCADE;
DROP TABLE IF EXISTS public.options CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS attempt_status CASCADE;
DROP TYPE IF EXISTS result_mode CASCADE;
DROP TYPE IF EXISTS exam_status CASCADE;

-- 1. Custom Types
CREATE TYPE exam_status AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'ENDED', 'ARCHIVED');
CREATE TYPE result_mode AS ENUM ('IMMEDIATE', 'MANUAL');
CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'ABANDONED');
CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'WRITTEN');

-- 2. Tables

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  programme TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exams
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  programme TEXT,
  duration_minutes INT NOT NULL,
  pass_mark INT NOT NULL DEFAULT 50,
  status exam_status NOT NULL DEFAULT 'DRAFT',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  result_release_mode result_mode NOT NULL DEFAULT 'MANUAL',
  instructions TEXT,
  access_code TEXT,
  roster_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'MULTIPLE_CHOICE',
  points INT NOT NULL DEFAULT 1,
  question_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Options (Publicly readable during exam, does NOT contain is_correct)
CREATE TABLE public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_order INT NOT NULL
);

-- Correct Answers (Secure table, only accessible by Admin / Service Role)
CREATE TABLE public.correct_answers (
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE PRIMARY KEY,
  correct_option_id UUID REFERENCES public.options(id) ON DELETE CASCADE,
  model_answer TEXT,
  rubric TEXT
);

-- Attempts
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score INT,
  percentage NUMERIC(5,2),
  passed BOOLEAN,
  UNIQUE(exam_id, user_id)
);

-- Answers
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.options(id) ON DELETE CASCADE,
  written_answer TEXT,
  is_correct BOOLEAN,
  points_awarded INT,
  ai_feedback TEXT,
  rubric_breakdown JSONB,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

-- Activity Logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exam Roster / Enrollments (Explicit candidate registration for exams)
CREATE TABLE public.exam_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, user_id)
);
CREATE INDEX idx_exam_roster_exam ON public.exam_roster(exam_id);
CREATE INDEX idx_exam_roster_user ON public.exam_roster(user_id);

-- 3. Row Level Security (RLS) Configuration

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correct_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_roster ENABLE ROW LEVEL SECURITY;

-- Utility Function: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (public.is_admin());

-- Exams Policies
CREATE POLICY "Anyone can read live/scheduled exams" ON public.exams FOR SELECT USING (status IN ('LIVE', 'SCHEDULED', 'ENDED'));
CREATE POLICY "Admins have full access to exams" ON public.exams FOR ALL USING (public.is_admin());

-- Questions & Options Policies (Students can read questions/options for LIVE exams)
CREATE POLICY "Students can read questions of active exams" ON public.questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND status = 'LIVE')
);
CREATE POLICY "Admins have full access to questions" ON public.questions FOR ALL USING (public.is_admin());

CREATE POLICY "Students can read options of active exams" ON public.options FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.questions q 
    JOIN public.exams e ON q.exam_id = e.id 
    WHERE q.id = question_id AND e.status = 'LIVE'
  )
);
CREATE POLICY "Admins have full access to options" ON public.options FOR ALL USING (public.is_admin());

-- Correct Answers Policies (Only Admins / Service Role)
CREATE POLICY "Admins have full access to correct answers" ON public.correct_answers FOR ALL USING (public.is_admin());

-- Attempts Policies
CREATE POLICY "Users can view own attempts" ON public.attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own attempts" ON public.attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own in_progress attempts" ON public.attempts FOR UPDATE USING (auth.uid() = user_id AND status = 'IN_PROGRESS');
CREATE POLICY "Admins have full access to attempts" ON public.attempts FOR ALL USING (public.is_admin());

-- Answers Policies
CREATE POLICY "Users can view own answers" ON public.answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.attempts WHERE id = attempt_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own answers" ON public.answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.attempts WHERE id = attempt_id AND user_id = auth.uid() AND status = 'IN_PROGRESS')
);
CREATE POLICY "Users can update own answers" ON public.answers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.attempts WHERE id = attempt_id AND user_id = auth.uid() AND status = 'IN_PROGRESS')
);
CREATE POLICY "Admins have full access to answers" ON public.answers FOR ALL USING (public.is_admin());

-- Activity Logs Policies
CREATE POLICY "Users can view own logs" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins have full access to logs" ON public.activity_logs FOR ALL USING (public.is_admin());

-- Exam Roster Policies
CREATE POLICY "Users can view own enrollments" ON public.exam_roster FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins have full access to exam roster" ON public.exam_roster FOR ALL USING (public.is_admin());

-- 4. Triggers to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, programme, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), new.email, new.raw_user_meta_data->>'programme', 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
