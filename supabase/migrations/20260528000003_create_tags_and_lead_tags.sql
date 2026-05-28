-- ── tags table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tags (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cor        TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- SELECT: any org member can read tags from their org
DROP POLICY IF EXISTS "Org members can view tags"   ON public.tags;
CREATE POLICY "Org members can view tags" ON public.tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
  );

-- INSERT: org members can create tags
DROP POLICY IF EXISTS "Org members can create tags" ON public.tags;
CREATE POLICY "Org members can create tags" ON public.tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
  );

-- UPDATE: org members can update tags
DROP POLICY IF EXISTS "Org members can update tags" ON public.tags;
CREATE POLICY "Org members can update tags" ON public.tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
  );

-- DELETE: org members can delete tags
DROP POLICY IF EXISTS "Org members can delete tags" ON public.tags;
CREATE POLICY "Org members can delete tags" ON public.tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = tags.org_id
    )
  );

-- ── lead_tags table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_tags (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can read lead_tags for leads in their org
DROP POLICY IF EXISTS "Org members can view lead_tags"   ON public.lead_tags;
CREATE POLICY "Org members can view lead_tags" ON public.lead_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN   public.memberships m ON m.org_id = l.org_id
      WHERE  l.id = lead_tags.lead_id AND m.user_id = auth.uid()
    )
  );

-- INSERT: org members can tag leads in their org
DROP POLICY IF EXISTS "Org members can create lead_tags" ON public.lead_tags;
CREATE POLICY "Org members can create lead_tags" ON public.lead_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN   public.memberships m ON m.org_id = l.org_id
      WHERE  l.id = lead_tags.lead_id AND m.user_id = auth.uid()
    )
  );

-- DELETE: org members can remove tags from leads in their org
DROP POLICY IF EXISTS "Org members can delete lead_tags" ON public.lead_tags;
CREATE POLICY "Org members can delete lead_tags" ON public.lead_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN   public.memberships m ON m.org_id = l.org_id
      WHERE  l.id = lead_tags.lead_id AND m.user_id = auth.uid()
    )
  );

-- ── Realtime ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tags;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
