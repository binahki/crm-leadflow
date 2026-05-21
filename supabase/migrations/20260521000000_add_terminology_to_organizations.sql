-- Add JSONB terminology column to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS terminology JSONB;

-- Seed existing orgs with the default revenda terminology
UPDATE organizations
SET terminology = '{
  "lead_singular": "lead",
  "lead_plural": "leads",
  "convertido_singular": "revendedora",
  "convertido_plural": "revendedoras",
  "convertido_curto": "rev",
  "status_convertido_label": "Aprovada",
  "custo_conversao_sigla": "CPR",
  "custo_conversao_completo": "Custo por Revendedora"
}'::jsonb
WHERE terminology IS NULL;
