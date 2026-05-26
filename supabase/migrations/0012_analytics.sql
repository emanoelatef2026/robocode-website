-- Migration: 0012_analytics
-- Purpose: Event tracking, snapshots, AI interaction logs
-- Dependencies: 0003_organization
-- Note: These tables are append-only by design. Partitioned for performance.

-- ─── Analytics Events (raw event stream) ─────────────────────────────────────
-- Partitioned by month. New partitions created by pg_cron monthly.
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          BIGSERIAL,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id   UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  session_id  TEXT,
  event_name  TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}',
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Initial partition (covers current period; add more via cron)
CREATE TABLE IF NOT EXISTS public.analytics_events_default
  PARTITION OF public.analytics_events DEFAULT;

COMMENT ON TABLE public.analytics_events IS
  'Raw event stream. Append-only. Never UPDATE or DELETE rows. Query via snapshots for performance.';

-- ─── Analytics Snapshots (pre-aggregated metrics) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type   TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'weekly', 'monthly')),
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'branch', 'group', 'instructor', 'student', 'course'
  )),
  entity_id       UUID NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  metrics         JSONB NOT NULL,   -- flexible metrics bag
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_type, entity_type, entity_id, period_start)
);

COMMENT ON TABLE public.analytics_snapshots IS
  'Pre-computed metrics. Dashboards read from here, not from raw events.';

-- ─── AI Interactions Log ─────────────────────────────────────────────────────
-- Future AI features: tracks every AI call for cost and debugging
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id     UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  agent_type    TEXT NOT NULL,    -- 'attendance_monitor', 'grade_assistant', etc.
  model         TEXT NOT NULL,    -- e.g. 'claude-sonnet-4-6'
  input_tokens  INTEGER,
  output_tokens INTEGER,
  latency_ms    INTEGER,
  cost_usd      NUMERIC(8, 6),
  -- Hash of input for deduplication
  input_hash    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AI Recommendations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID REFERENCES public.students(id) ON DELETE CASCADE,
  generated_by_agent  TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,  -- 'at_risk', 'learning_path', 'engagement'
  content             JSONB NOT NULL,
  confidence_score    NUMERIC(4, 3),   -- 0.000 to 1.000
  reviewed_by         UUID REFERENCES public.users(id),
  acted_upon          BOOLEAN,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ
);

-- ─── AI Reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  report_type          TEXT NOT NULL,  -- 'progress_summary', 'attendance_analysis'
  period_start         DATE NOT NULL,
  period_end           DATE NOT NULL,
  content              TEXT NOT NULL,  -- generated narrative text
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_by_parent_at  TIMESTAMPTZ
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_events_user     ON public.analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_branch   ON public.analytics_events(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name     ON public.analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_props    ON public.analytics_events USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_snapshots_entity          ON public.analytics_snapshots(entity_type, entity_id, period_start);
CREATE INDEX IF NOT EXISTS idx_ai_recs_student           ON public.ai_recommendations(student_id, created_at);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

-- Analytics events: users log their own
CREATE POLICY "analytics_events_self_insert"
  ON public.analytics_events FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Snapshots: readable by staff with analytics permission
CREATE POLICY "snapshots_read"
  ON public.analytics_snapshots FOR SELECT
  USING (public.user_has_permission(auth.uid(), 'read_analytics'));

-- AI reports: parent reads for child; staff with permission reads all
CREATE POLICY "ai_reports_parent_read"
  ON public.ai_reports FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
    OR public.user_has_permission(auth.uid(), 'read_ai_reports')
  );
