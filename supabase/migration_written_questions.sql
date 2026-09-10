-- Migration: Add Written/Essay Question Support
-- Run this in Supabase SQL Editor

-- 1. Add question_type enum and column
DO $$ BEGIN
  CREATE TYPE question_type AS ENUM ('MULTIPLE_CHOICE', 'WRITTEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS question_type question_type NOT NULL DEFAULT 'MULTIPLE_CHOICE';

-- 2. Add written_answer column to answers table
ALTER TABLE public.answers 
  ADD COLUMN IF NOT EXISTS written_answer TEXT;

-- 3. Relax NOT NULL on selected_option_id (written questions won't have it)
-- We need to recreate the FK constraint since selected_option_id was NOT NULL by implication
-- Actually selected_option_id is nullable by schema definition, so no change needed there.

-- 4. Add model_answer to correct_answers for written questions (optional grading reference)
ALTER TABLE public.correct_answers
  ADD COLUMN IF NOT EXISTS model_answer TEXT;
