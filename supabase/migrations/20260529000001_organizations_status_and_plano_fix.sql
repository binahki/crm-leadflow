-- Add status column to organizations (replaces using ativo boolean for admin mgmt)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';

-- Fix any invalid plano values to 'gratuito'
UPDATE public.organizations
SET plano = 'gratuito'
WHERE plano IS NULL
   OR plano = ''
   OR plano = 'basic'
   OR plano = 'trial'
   OR plano = 'free'
   OR plano NOT IN ('gratuito', 'starter', 'pro', 'enterprise');

-- Sync status from ativo boolean for existing rows
UPDATE public.organizations SET status = 'ativo'   WHERE ativo = true  OR ativo IS NULL;
UPDATE public.organizations SET status = 'suspenso' WHERE ativo = false;
