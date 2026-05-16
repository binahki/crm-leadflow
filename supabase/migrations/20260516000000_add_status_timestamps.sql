-- Adiciona colunas de timestamp por status na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_atendimento_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_reuniao_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_contrato_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_aprovado_at timestamptz;

-- Backfill: preenche status_aprovado_at para leads já aprovados usando ultimo_status_change como referência
UPDATE leads
SET status_aprovado_at = COALESCE(
  ultimo_status_change,
  created_at::timestamptz
)
WHERE status::text = '3'
  AND status_aprovado_at IS NULL;

-- Índices para performance nas queries de período
CREATE INDEX IF NOT EXISTS idx_leads_aprovado_at    ON leads(status_aprovado_at);
CREATE INDEX IF NOT EXISTS idx_leads_atendimento_at ON leads(status_atendimento_at);
CREATE INDEX IF NOT EXISTS idx_leads_reuniao_at     ON leads(status_reuniao_at);
CREATE INDEX IF NOT EXISTS idx_leads_contrato_at    ON leads(status_contrato_at);
