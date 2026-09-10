-- Migration to support AI-Assisted Written Answer Grading with Rubrics
-- Run this in your Supabase SQL Editor

-- 1. Add rubric column to correct_answers (to store the admin's grading criteria)
ALTER TABLE public.correct_answers 
ADD COLUMN IF NOT EXISTS rubric TEXT;

-- 2. Add ai_feedback and rubric_breakdown columns to answers
ALTER TABLE public.answers 
ADD COLUMN IF NOT EXISTS ai_feedback TEXT;

ALTER TABLE public.answers 
ADD COLUMN IF NOT EXISTS rubric_breakdown JSONB;
