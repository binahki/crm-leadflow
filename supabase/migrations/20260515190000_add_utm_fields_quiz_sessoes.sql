-- Add utm_content and utm_term columns to quiz_sessoes
ALTER TABLE public.quiz_sessoes ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE public.quiz_sessoes ADD COLUMN IF NOT EXISTS utm_term text;
