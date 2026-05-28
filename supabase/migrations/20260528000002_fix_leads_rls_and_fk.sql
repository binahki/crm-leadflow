-- 1. Add org-member DELETE policy on leads
--    (existing policy only covers user_id; org leads set org_id, not user_id)
DROP POLICY IF EXISTS "Org members can delete org leads" ON public.leads;
CREATE POLICY "Org members can delete org leads" ON public.leads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id  = leads.org_id
    )
  );

-- 2. Robustly re-create lead_tags.lead_id FK with CASCADE
--    Drop whatever the existing FK is named, then add with ON DELETE CASCADE.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM   pg_constraint c
    JOIN   pg_attribute  a ON a.attrelid = c.conrelid
                           AND a.attnum  = ANY(c.conkey)
    WHERE  c.conrelid = 'public.lead_tags'::regclass
      AND  c.contype  = 'f'
      AND  a.attname  = 'lead_id'
  LOOP
    EXECUTE 'ALTER TABLE public.lead_tags DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.lead_tags
  ADD CONSTRAINT lead_tags_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- 3. Robustly re-create quiz_sessoes.lead_id FK with SET NULL
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM   pg_constraint c
    JOIN   pg_attribute  a ON a.attrelid = c.conrelid
                           AND a.attnum  = ANY(c.conkey)
    WHERE  c.conrelid = 'public.quiz_sessoes'::regclass
      AND  c.contype  = 'f'
      AND  a.attname  = 'lead_id'
  LOOP
    EXECUTE 'ALTER TABLE public.quiz_sessoes DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.quiz_sessoes
  ADD CONSTRAINT quiz_sessoes_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
