-- Migration: 0011_notifications
-- Purpose: Notifications, announcements, feedback notes, notification preferences
-- Dependencies: 0003_organization

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,    -- e.g. 'attendance_absent', 'assignment_graded'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',  -- contextual payload
  created_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id, channel)
);

-- ─── Notification Preferences ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  event_type  TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel, event_type)
);

-- ─── Announcements ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  group_id    UUID REFERENCES public.groups(id) ON DELETE CASCADE,  -- NULL = branch-wide
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES public.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  is_pinned   BOOLEAN NOT NULL DEFAULT false,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- ─── Instructor Feedback Notes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  instructor_id     UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  group_id          UUID REFERENCES public.groups(id),
  content           TEXT NOT NULL,
  rating            INTEGER CHECK (rating BETWEEN 1 AND 5),
  visible_to_parent BOOLEAN NOT NULL DEFAULT false,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user    ON public.notification_recipients(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_unread  ON public.notification_recipients(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_branch            ON public.announcements(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_group             ON public.announcements(group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_notes_student          ON public.feedback_notes(student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_notes_instructor       ON public.feedback_notes(instructor_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_notes ENABLE ROW LEVEL SECURITY;

-- Notification recipients: users see only their own
CREATE POLICY "notification_recipients_self"
  ON public.notification_recipients FOR ALL
  USING (user_id = auth.uid());

-- Preferences: self-managed
CREATE POLICY "notification_preferences_self"
  ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- Announcements: visible to branch/group members
CREATE POLICY "announcements_read"
  ON public.announcements FOR SELECT
  USING (
    deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      branch_id IN (
        SELECT DISTINCT branch_id FROM public.user_roles
        WHERE user_id = auth.uid() AND branch_id IS NOT NULL
      )
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "announcements_manage"
  ON public.announcements FOR ALL
  USING (public.user_has_permission(auth.uid(), 'send_announcements', branch_id));

-- Feedback: instructor manages own; student reads own; parent reads if visible
CREATE POLICY "feedback_notes_instructor"
  ON public.feedback_notes FOR ALL
  USING (
    instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_feedback')
  );

CREATE POLICY "feedback_notes_student_read"
  ON public.feedback_notes FOR SELECT
  USING (
    deleted_at IS NULL
    AND student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "feedback_notes_parent_read"
  ON public.feedback_notes FOR SELECT
  USING (
    deleted_at IS NULL
    AND visible_to_parent = true
    AND student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );
