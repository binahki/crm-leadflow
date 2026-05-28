-- Fix FK constraints so that deleting a lead cascades automatically,
-- removing the need for client-side cleanup that can silently fail under RLS.

-- quiz_sessoes.lead_id: set to NULL when lead is deleted
ALTER TABLE public.quiz_sessoes
  DROP CONSTRAINT IF EXISTS quiz_sessoes_lead_id_fkey;
ALTER TABLE public.quiz_sessoes
  ADD CONSTRAINT quiz_sessoes_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

-- lead_tags.lead_id: delete the junction row when lead is deleted
ALTER TABLE public.lead_tags
  DROP CONSTRAINT IF EXISTS lead_tags_lead_id_fkey;
ALTER TABLE public.lead_tags
  ADD CONSTRAINT lead_tags_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
