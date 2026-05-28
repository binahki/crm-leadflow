-- Add score cutoff and quiz config columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS score_corte_verde   integer  DEFAULT 35,
  ADD COLUMN IF NOT EXISTS score_corte_amarelo integer  DEFAULT 25,
  ADD COLUMN IF NOT EXISTS configuracoes       jsonb    DEFAULT '{"campos_perfil":[],"faixas_score":{"travas":[],"vermelho_se_todas":false}}'::jsonb,
  ADD COLUMN IF NOT EXISTS usa_quiz_externo    boolean  DEFAULT false;
