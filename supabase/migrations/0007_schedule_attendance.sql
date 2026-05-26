-- Migration: 0007_schedule_attendance
-- Purpose: Class schedules, attendance records, session recordings, makeup sessions
-- Dependencies: 0006_curriculum

-- ─── Schedules (class sessions) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_course_id  UUID NOT NULL REFERENCES public.group_courses(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  type             TEXT NOT NULL DEFAULT 'regular'
                   CHECK (type IN ('regular', 'makeup', 'exam', 'event')),
  delivery         TEXT CHECK (delivery IN ('online', 'offline', 'hybrid')),
  meeting_url      TEXT,   -- Zoom/Meet/Teams URL for online sessions
  room             TEXT,   -- Room name/number for offline sessions
  status           TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  cancellation_reason TEXT,
  created_by       UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Session Recordings ───────────────────────────────────────────────────────
-- Recordings are NOT stored in Supabase Storage.
-- We store only metadata + external provider links (Google Drive, etc.)
CREATE TABLE IF NOT EXISTS public.session_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id      UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES public.branches(id),
  title            TEXT,
  provider         TEXT NOT NULL CHECK (provider IN ('google_drive', 'youtube', 'vimeo', 'zoom', 'other')),
  external_url     TEXT NOT NULL,   -- The actual recording link
  external_id      TEXT,            -- Provider-specific ID (for embedding)
  duration_seconds INTEGER,
  recorded_by      UUID REFERENCES public.users(id),
  -- Access control flags
  visible_to_students BOOLEAN NOT NULL DEFAULT true,
  visible_to_parents  BOOLEAN NOT NULL DEFAULT false,
  expires_at       TIMESTAMPTZ,     -- When access expires (null = forever)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Attendance Records ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status            TEXT NOT NULL
                    CHECK (status IN ('present', 'absent', 'late', 'excused', 'makeup')),
  late_minutes      INTEGER,        -- NULL unless status = 'late'
  recorded_by       UUID NOT NULL REFERENCES public.users(id),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes             TEXT,
  -- If status = 'makeup', links to the makeup schedule entry
  makeup_schedule_id UUID REFERENCES public.schedules(id),
  UNIQUE (schedule_id, student_id)
);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schedules_group_course   ON public.schedules(group_course_id);
CREATE INDEX IF NOT EXISTS idx_schedules_branch_id      ON public.schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at   ON public.schedules(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_schedules_status         ON public.schedules(status);
CREATE INDEX IF NOT EXISTS idx_attendance_schedule_id   ON public.attendance_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id    ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status        ON public.attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_recordings_schedule_id   ON public.session_recordings(schedule_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Schedules: visible to branch members in the relevant group
CREATE POLICY "schedules_read"
  ON public.schedules FOR SELECT
  USING (
    branch_id IN (
      SELECT DISTINCT branch_id FROM public.user_roles
      WHERE user_id = auth.uid() AND branch_id IS NOT NULL
    )
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

CREATE POLICY "schedules_manage"
  ON public.schedules FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_schedule', branch_id))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_schedule', branch_id));

-- Recordings: students in the group or instructors can view
CREATE POLICY "recordings_read_by_student"
  ON public.session_recordings FOR SELECT
  USING (
    visible_to_students = true
    AND (expires_at IS NULL OR expires_at > now())
    AND schedule_id IN (
      SELECT s.id FROM public.schedules s
      JOIN public.group_courses gc ON gc.id = s.group_course_id
      JOIN public.group_students gs ON gs.group_id = gc.group_id
      JOIN public.students st ON st.id = gs.student_id
      WHERE st.user_id = auth.uid()
    )
  );

CREATE POLICY "recordings_read_by_parent"
  ON public.session_recordings FOR SELECT
  USING (
    visible_to_parents = true
    AND (expires_at IS NULL OR expires_at > now())
    AND schedule_id IN (
      SELECT s.id FROM public.schedules s
      JOIN public.group_courses gc ON gc.id = s.group_course_id
      JOIN public.group_students gs ON gs.group_id = gc.group_id
      JOIN public.parent_students ps ON ps.student_id = gs.student_id
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "recordings_manage"
  ON public.session_recordings FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_schedule', branch_id));

-- Attendance: instructors record for their classes; students/parents read own
CREATE POLICY "attendance_read_own_student"
  ON public.attendance_records FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "attendance_read_own_parent"
  ON public.attendance_records FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_manage_by_instructor"
  ON public.attendance_records FOR ALL
  USING (
    schedule_id IN (
      SELECT s.id FROM public.schedules s
      WHERE public.user_has_permission(auth.uid(), 'manage_attendance', s.branch_id)
    )
  );
