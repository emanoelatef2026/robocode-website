CREATE TABLE public.student_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 160),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 800),
  youtube_url TEXT NOT NULL CHECK (youtube_url ~* '^https?://(www\\.)?(youtube\\.com|youtu\\.be)/'),
  youtube_id TEXT NOT NULL CHECK (char_length(youtube_id) BETWEEN 6 AND 32),
  thumbnail_url TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'short' CHECK (format = 'short'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, youtube_id)
);
CREATE INDEX idx_student_videos_student_created ON public.student_videos (student_id, created_at DESC);
ALTER TABLE public.student_videos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_videos TO authenticated;
CREATE POLICY "student_videos_select_own" ON public.student_videos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_videos.student_id AND s.user_id = (SELECT auth.uid())));
CREATE POLICY "student_videos_insert_own" ON public.student_videos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_videos.student_id AND s.user_id = (SELECT auth.uid())));
CREATE POLICY "student_videos_update_own" ON public.student_videos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_videos.student_id AND s.user_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_videos.student_id AND s.user_id = (SELECT auth.uid())));
CREATE POLICY "student_videos_delete_own" ON public.student_videos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_videos.student_id AND s.user_id = (SELECT auth.uid())));
