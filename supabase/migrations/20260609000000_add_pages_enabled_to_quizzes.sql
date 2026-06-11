-- pages_enabled: null = legacy quiz (show all pages), [] = new quiz (no optional pages), ['analise','approval',...] = explicit list
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS pages_enabled text[] DEFAULT NULL;
