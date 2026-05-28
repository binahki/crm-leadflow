-- Expand RLS policies on tags and lead_tags to also grant access to gestores
-- who manage the org via the gestor_orgs table.
--
-- Gestores use their own auth.uid() but access client orgs via localStorage;
-- they are never in memberships for those orgs, so the existing policies block them.

-- ── tags ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Org members can view tags"   ON public.tags;
CREATE POLICY "Org members can view tags" ON public.tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = tags.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

DROP POLICY IF EXISTS "Org members can create tags" ON public.tags;
CREATE POLICY "Org members can create tags" ON public.tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = tags.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

DROP POLICY IF EXISTS "Org members can update tags" ON public.tags;
CREATE POLICY "Org members can update tags" ON public.tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = tags.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

DROP POLICY IF EXISTS "Org members can delete tags" ON public.tags;
CREATE POLICY "Org members can delete tags" ON public.tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.gestor_orgs go
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE go.org_id = tags.org_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

-- ── lead_tags ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Org members can view lead_tags"   ON public.lead_tags;
CREATE POLICY "Org members can view lead_tags" ON public.lead_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.memberships m ON m.org_id = l.org_id
      WHERE l.id = lead_tags.lead_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.gestor_orgs go ON go.org_id = l.org_id
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE l.id = lead_tags.lead_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

DROP POLICY IF EXISTS "Org members can create lead_tags" ON public.lead_tags;
CREATE POLICY "Org members can create lead_tags" ON public.lead_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.memberships m ON m.org_id = l.org_id
      WHERE l.id = lead_tags.lead_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.gestor_orgs go ON go.org_id = l.org_id
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE l.id = lead_tags.lead_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );

DROP POLICY IF EXISTS "Org members can delete lead_tags" ON public.lead_tags;
CREATE POLICY "Org members can delete lead_tags" ON public.lead_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.memberships m ON m.org_id = l.org_id
      WHERE l.id = lead_tags.lead_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.gestor_orgs go ON go.org_id = l.org_id
      JOIN public.gestores g ON g.user_id = go.gestor_user_id
      WHERE l.id = lead_tags.lead_id
        AND go.gestor_user_id = auth.uid()
        AND g.ativo = true
    )
  );
