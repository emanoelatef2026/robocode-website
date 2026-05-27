-- Migration: 0027_certificate_snapshots
-- Purpose: Immutable audit snapshot of eligibility scores at time of certificate issuance
-- Dependencies: 0024_certificate_system, 0026_student_course_progress
--
-- Design notes:
--   * One row per certificate (UNIQUE on certificate_id)
--   * ON DELETE CASCADE — snapshot disappears if certificate is deleted
--   * Immutable: UPDATE and DELETE are blocked by row-level triggers
--     (service-role also blocked — not just RLS)
--   * Only created for certificates that have a semester_id (progress-tracked certs)

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.certificate_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id        UUID NOT NULL UNIQUE
                        REFERENCES public.certificates(id) ON DELETE CASCADE,
  -- Scores captured at issuance time
  attendance_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  assignment_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  portfolio_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  overall_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  courses_evaluated     INTEGER NOT NULL DEFAULT 0,
  -- Thresholds that were applied
  threshold_attendance  NUMERIC(5,2) NOT NULL,
  threshold_assignment  NUMERIC(5,2) NOT NULL,
  threshold_overall     NUMERIC(5,2) NOT NULL,
  -- Eligibility verdict
  is_eligible           BOOLEAN NOT NULL,
  eligibility_detail    JSONB,
  -- Timestamps
  calculated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.certificate_snapshots IS
  'Immutable record of eligibility scores at time of certificate issuance. One row per certificate.';

-- ─── Immutability triggers ────────────────────────────────────────────────────
-- Block UPDATE and DELETE at the storage layer — applies even to service role.

CREATE OR REPLACE FUNCTION public.prevent_snapshot_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'certificate_snapshots rows are immutable after insert';
  RETURN NULL;
END;
$$;

CREATE TRIGGER snapshots_no_update
  BEFORE UPDATE ON public.certificate_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_snapshot_mutation();

CREATE TRIGGER snapshots_no_delete
  BEFORE DELETE ON public.certificate_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_snapshot_mutation();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_certificate_snapshots_certificate
  ON public.certificate_snapshots(certificate_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.certificate_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin can insert snapshots
CREATE POLICY "snapshots_admin_insert"
  ON public.certificate_snapshots FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_certificates')
           OR public.user_has_permission(auth.uid(), 'manage_system'));

-- Admin can read all snapshots
CREATE POLICY "snapshots_admin_read"
  ON public.certificate_snapshots FOR SELECT
  USING (public.user_has_permission(auth.uid(), 'manage_certificates')
      OR public.user_has_permission(auth.uid(), 'manage_system'));

-- Student can read their own snapshot (via certificate ownership)
CREATE POLICY "snapshots_student_read"
  ON public.certificate_snapshots FOR SELECT
  USING (
    certificate_id IN (
      SELECT id FROM public.certificates
      WHERE student_id IN (
        SELECT id FROM public.students WHERE user_id = auth.uid()
      )
    )
  );

-- Public: anyone can read snapshot for an active certificate (verification page)
CREATE POLICY "snapshots_public_read"
  ON public.certificate_snapshots FOR SELECT
  USING (
    certificate_id IN (
      SELECT id FROM public.certificates WHERE status = 'active'
    )
  );
