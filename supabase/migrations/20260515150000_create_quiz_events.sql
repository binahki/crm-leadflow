-- Create quiz_events table for granular tracking
CREATE TABLE IF NOT EXISTS public.quiz_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  session_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'view', 'start', 'step', 'analise', 'conversion_start', 'finish', 'abandon'
  step_id TEXT, -- ID da pergunta ou etapa
  step_title TEXT, -- Título da pergunta ou etapa para facilidade de leitura
  answer JSONB, -- Resposta dada (se houver)
  score_parcial INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0, -- Tempo gasto nesta etapa em milissegundos
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  utms JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.quiz_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow anonymous inserts to quiz_events" 
ON public.quiz_events FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow users to view their organization's quiz events" 
ON public.quiz_events FOR SELECT 
USING (true); -- Simplifying for now to allow dashboard to read. 
-- In production, this should be linked to org_id/auth.uid()

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_events;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_events_quiz_id ON public.quiz_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_events_session_id ON public.quiz_events(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_events_created_at ON public.quiz_events(created_at);
