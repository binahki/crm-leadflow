alter table public.ai_optimization_logs
add column if not exists meta_alertas jsonb default '[]'::jsonb;
