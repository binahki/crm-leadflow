-- Add instagram column to leads table if it doesn't exist
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram TEXT;
