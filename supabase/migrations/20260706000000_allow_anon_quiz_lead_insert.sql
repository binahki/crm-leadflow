-- Permite que quizzes públicos (anon key) insiram leads diretamente.
-- A policy anterior exige auth.uid() (membro da org), o que bloqueia
-- inserções feitas pelo quiz com a anon key do browser.

DROP POLICY IF EXISTS "Public quiz submissions can insert leads" ON public.leads;

CREATE POLICY "Public quiz submissions can insert leads" ON public.leads
  FOR INSERT WITH CHECK (
    -- Só aplica quando não há sessão autenticada (quiz público, anon key)
    auth.uid() IS NULL
    AND org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = leads.org_id
    )
  );
