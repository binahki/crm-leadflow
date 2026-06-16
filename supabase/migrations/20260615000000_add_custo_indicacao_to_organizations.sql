ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS custo_indicacao numeric DEFAULT 0;
