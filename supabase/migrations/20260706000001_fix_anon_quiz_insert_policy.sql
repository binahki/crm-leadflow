-- Fix: a policy anterior usava EXISTS (SELECT FROM organizations), mas o role
-- anon pode não ter SELECT nessa tabela → EXISTS retorna false → INSERT bloqueado.
-- Simplificando para checar apenas org_id IS NOT NULL.

DROP POLICY IF EXISTS "Public quiz submissions can insert leads" ON public.leads;

CREATE POLICY "Public quiz submissions can insert leads" ON public.leads
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL
    AND org_id IS NOT NULL
  );

-- Garante que o role anon tem permissão de INSERT na tabela leads
GRANT INSERT ON public.leads TO anon;
