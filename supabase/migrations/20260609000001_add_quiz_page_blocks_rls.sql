-- ── ENABLE RLS & ADD POLICIES FOR quiz_page_blocks ──────────────────────────

-- Enable RLS (idempotent)
ALTER TABLE public.quiz_page_blocks ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy
DROP POLICY IF EXISTS "Users can view quiz page blocks" ON public.quiz_page_blocks;
CREATE POLICY "Users can view quiz page blocks" ON public.quiz_page_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.memberships m ON m.org_id = q.org_id
      WHERE q.id = quiz_page_blocks.quiz_id
        AND m.user_id = auth.uid()
    )
  );

-- 2. INSERT Policy
DROP POLICY IF EXISTS "Users can insert quiz page blocks" ON public.quiz_page_blocks;
CREATE POLICY "Users can insert quiz page blocks" ON public.quiz_page_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.memberships m ON m.org_id = q.org_id
      WHERE q.id = quiz_page_blocks.quiz_id
        AND m.user_id = auth.uid()
    )
  );

-- 3. UPDATE Policy
DROP POLICY IF EXISTS "Users can update quiz page blocks" ON public.quiz_page_blocks;
CREATE POLICY "Users can update quiz page blocks" ON public.quiz_page_blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.memberships m ON m.org_id = q.org_id
      WHERE q.id = quiz_page_blocks.quiz_id
        AND m.user_id = auth.uid()
    )
  );

-- 4. DELETE Policy
DROP POLICY IF EXISTS "Users can delete quiz page blocks" ON public.quiz_page_blocks;
CREATE POLICY "Users can delete quiz page blocks" ON public.quiz_page_blocks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.memberships m ON m.org_id = q.org_id
      WHERE q.id = quiz_page_blocks.quiz_id
        AND m.user_id = auth.uid()
    )
  );
