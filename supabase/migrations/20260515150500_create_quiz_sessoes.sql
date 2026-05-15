create table if not exists public.quiz_sessoes (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  quiz_slug text not null,
  org_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ultima_etapa int default 0,
  total_etapas int default 0,
  respostas jsonb default '{}',
  concluiu boolean default false,
  virou_lead boolean default false,
  lead_id uuid references public.leads(id),
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  dispositivo text
);

create index if not exists idx_quiz_sessoes_slug on public.quiz_sessoes(quiz_slug);
create index if not exists idx_quiz_sessoes_org on public.quiz_sessoes(org_id);
create index if not exists idx_quiz_sessoes_created on public.quiz_sessoes(created_at desc);

alter table public.quiz_sessoes enable row level security;
create policy "quiz_sessoes_insert" on public.quiz_sessoes for insert with check (true);
create policy "quiz_sessoes_update" on public.quiz_sessoes for update using (true);
create policy "quiz_sessoes_select" on public.quiz_sessoes for select using (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_sessoes;
