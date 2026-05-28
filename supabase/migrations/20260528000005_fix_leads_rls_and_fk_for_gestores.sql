-- ── EXPAND RLS POLICIES FOR GESTORES ON LEADS ─────────────────────────────────

-- 1. SELECT Policy
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Org members can view org leads" ON public.leads;
DROP POLICY IF EXISTS "Org members and gestores can view leads" ON public.leads;

CREATE POLICY "Org members and gestores can view leads" ON public.leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = leads.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = leads.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

-- 2. INSERT Policy
DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
DROP POLICY IF EXISTS "Org members can create org leads" ON public.leads;
DROP POLICY IF EXISTS "Org members and gestores can insert leads" ON public.leads;

CREATE POLICY "Org members and gestores can insert leads" ON public.leads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = leads.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = leads.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

-- 3. UPDATE Policy
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Org members can update org leads" ON public.leads;
DROP POLICY IF EXISTS "Org members and gestores can update leads" ON public.leads;

CREATE POLICY "Org members and gestores can update leads" ON public.leads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = leads.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = leads.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

-- 4. DELETE Policy
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
DROP POLICY IF EXISTS "Org members can delete org leads" ON public.leads;
DROP POLICY IF EXISTS "Org members and gestores can delete leads" ON public.leads;

CREATE POLICY "Org members and gestores can delete leads" ON public.leads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = leads.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = leads.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

-- FK constraints with CASCADE/SET NULL were already applied in
-- 20260528000000 and 20260528000002 — no need to repeat here.
